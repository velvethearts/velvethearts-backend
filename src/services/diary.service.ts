import { prisma } from '../config/database';
import { UploadService } from './upload.service';
import { io } from '../socket';
import { logger } from '../utils/logger';
import { encryptMessage, decryptMessage } from '../utils/crypto';

export class DiaryService {
  private uploadService = new UploadService();

  /**
   * Helper to verify that the match exists, is active, and the user is a participant.
   */
  private async verifyMatchParticipant(userId: string, matchId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { conversation: true },
    });

    if (!match) {
      throw new Error('Match not found');
    }
    if (match.unmatched) {
      throw new Error('This match is no longer active');
    }
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('You are not part of this match');
    }

    const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
    return { match, partnerId };
  }

  /**
   * List all diary entries for a match in chronological order.
   */
  async getEntries(userId: string, matchId: string) {
    await this.verifyMatchParticipant(userId, matchId);

    const entries = await (prisma as any).diaryEntry.findMany({
      where: { matchId },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      include: {
        savedBy: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                photos: {
                  take: 1,
                  select: { secureUrl: true },
                },
              },
            },
          },
        },
      },
    });

    return entries.map((entry: any) => ({
      id: entry.id,
      matchId: entry.matchId,
      savedByUserId: entry.savedByUserId,
      savedByName: entry.savedBy?.profile?.name || 'Partner',
      savedByPhoto: entry.savedBy?.profile?.photos?.[0]?.secureUrl || null,
      isMine: entry.savedByUserId === userId,
      sourceType: entry.sourceType,
      content: entry.content ? decryptMessage(entry.content) : null,
      attachmentUrl: entry.attachmentUrl,
      attachmentPublicId: entry.attachmentPublicId,
      caption: entry.caption ? decryptMessage(entry.caption) : null,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Save a chat message to Our Diary.
   */
  async saveMessage(
    userId: string,
    matchId: string,
    messageId?: string,
    caption?: string,
    fallbackData?: { text?: string; attachmentUrl?: string; sourceType?: string }
  ) {
    const { match } = await this.verifyMatchParticipant(userId, matchId);

    // Fetch the message with its attachments and conversation if messageId exists
    let message = null;
    if (messageId) {
      try {
        message = await prisma.message.findUnique({
          where: { id: messageId },
          include: { attachments: true, conversation: true },
        });
      } catch (_) {}
    }

    let sourceType: 'MESSAGE' | 'VOICE_NOTE' | 'IMAGE' | 'VIDEO' = 'MESSAGE';
    let content: string | null = null;
    let attachmentUrl: string | null = null;
    let attachmentPublicId: string | null = null;

    if (message) {
      content = message.text ? (decryptMessage(message.text) ?? null) : null;
      if (message.attachments && message.attachments.length > 0) {
        const firstAtt = message.attachments[0];
        if (firstAtt.fileType === 'AUDIO' || firstAtt.secureUrl?.includes('voice-note')) {
          sourceType = 'VOICE_NOTE';
          attachmentUrl = firstAtt.secureUrl;
          attachmentPublicId = firstAtt.cloudinaryPublicId || null;
        } else if (firstAtt.fileType === 'VIDEO' || firstAtt.secureUrl?.match(/\.(mp4|mov|webm|mkv|m4v)/i)) {
          sourceType = 'VIDEO';
          attachmentUrl = firstAtt.secureUrl;
          attachmentPublicId = firstAtt.cloudinaryPublicId || null;
        } else if (firstAtt.fileType === 'IMAGE') {
          sourceType = 'IMAGE';
          attachmentUrl = firstAtt.secureUrl;
          attachmentPublicId = firstAtt.cloudinaryPublicId || null;
        }
      }
    } else if (fallbackData?.text || fallbackData?.attachmentUrl) {
      content = fallbackData.text || null;
      attachmentUrl = fallbackData.attachmentUrl || null;
      sourceType = (fallbackData.sourceType as any) || (attachmentUrl?.includes('voice') ? 'VOICE_NOTE' : (attachmentUrl?.match(/\.(mp4|mov|webm|mkv|m4v)/i) ? 'VIDEO' : 'MESSAGE'));
    } else {
      throw new Error('Message not found');
    }

    // Debounce duplicate saves (within 15s window)
    const recentDuplicate = await (prisma as any).diaryEntry.findFirst({
      where: {
        matchId,
        savedByUserId: userId,
        sourceType,
        attachmentUrl: attachmentUrl || undefined,
        createdAt: { gte: new Date(Date.now() - 15000) },
      },
      include: {
        savedBy: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                photos: { take: 1, select: { secureUrl: true } },
              },
            },
          },
        },
      },
    });

    if (recentDuplicate) {
      return {
        id: recentDuplicate.id,
        matchId: recentDuplicate.matchId,
        savedByUserId: recentDuplicate.savedByUserId,
        savedByName: recentDuplicate.savedBy?.profile?.name || 'Partner',
        savedByPhoto: recentDuplicate.savedBy?.profile?.photos?.[0]?.secureUrl || null,
        isMine: true,
        sourceType: recentDuplicate.sourceType,
        content,
        attachmentUrl: recentDuplicate.attachmentUrl,
        attachmentPublicId: recentDuplicate.attachmentPublicId,
        caption: recentDuplicate.caption ? decryptMessage(recentDuplicate.caption) : null,
        createdAt: recentDuplicate.createdAt,
      };
    }

    const encryptedContent = content ? (encryptMessage(content) ?? null) : null;
    const encryptedCaption = caption?.trim() ? (encryptMessage(caption.trim()) ?? null) : null;

    const newEntry = await (prisma as any).diaryEntry.create({
      data: {
        matchId,
        savedByUserId: userId,
        sourceType,
        content: encryptedContent,
        attachmentUrl,
        attachmentPublicId,
        caption: encryptedCaption,
      },
      include: {
        savedBy: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                photos: { take: 1, select: { secureUrl: true } },
              },
            },
          },
        },
      },
    });

    // Notify conversation room via Socket.IO
    if (match.conversation?.id) {
      io.to(`conversation_${match.conversation.id}`).emit('diary_entry_added', {
        matchId,
        entryId: newEntry.id,
        savedByUserId: userId,
      });
    }

    return {
      id: newEntry.id,
      matchId: newEntry.matchId,
      savedByUserId: newEntry.savedByUserId,
      savedByName: newEntry.savedBy?.profile?.name || 'Partner',
      savedByPhoto: newEntry.savedBy?.profile?.photos?.[0]?.secureUrl || null,
      isMine: true,
      sourceType: newEntry.sourceType,
      content,
      attachmentUrl: newEntry.attachmentUrl,
      attachmentPublicId: newEntry.attachmentPublicId,
      caption: caption?.trim() || null,
      createdAt: newEntry.createdAt,
    };
  }

  /**
   * Add a standalone freeform note to Our Diary.
   */
  async addNote(userId: string, matchId: string, text: string, caption?: string) {
    const { match } = await this.verifyMatchParticipant(userId, matchId);

    if (!text || !text.trim()) {
      throw new Error('Note content cannot be empty');
    }

    const encryptedContent = encryptMessage(text.trim()) ?? text.trim();
    const encryptedCaption = caption?.trim() ? (encryptMessage(caption.trim()) ?? null) : null;

    const newEntry = await (prisma as any).diaryEntry.create({
      data: {
        matchId,
        savedByUserId: userId,
        sourceType: 'NOTE',
        content: encryptedContent,
        caption: encryptedCaption,
      },
      include: {
        savedBy: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                photos: { take: 1, select: { secureUrl: true } },
              },
            },
          },
        },
      },
    });

    if (match.conversation?.id) {
      io.to(`conversation_${match.conversation.id}`).emit('diary_entry_added', {
        matchId,
        entryId: newEntry.id,
        savedByUserId: userId,
      });
    }

    return {
      id: newEntry.id,
      matchId: newEntry.matchId,
      savedByUserId: newEntry.savedByUserId,
      savedByName: newEntry.savedBy?.profile?.name || 'Partner',
      savedByPhoto: newEntry.savedBy?.profile?.photos?.[0]?.secureUrl || null,
      isMine: true,
      sourceType: newEntry.sourceType,
      content: text.trim(),
      attachmentUrl: null,
      attachmentPublicId: null,
      caption: caption?.trim() || null,
      createdAt: newEntry.createdAt,
    };
  }

  /**
   * Upload a photo or video to Our Diary (moderated via AWS Rekognition via UploadService).
   */
  async uploadPhoto(userId: string, matchId: string, fileBuffer: Buffer, mimeType: string, caption?: string) {
    const { match } = await this.verifyMatchParticipant(userId, matchId);

    // Upload through UploadService.uploadImage which executes AWS Rekognition moderation
    const uploadResult = await this.uploadService.uploadImage(fileBuffer, 'velvet_hearts/diary', mimeType);

    const encryptedCaption = caption?.trim() ? (encryptMessage(caption.trim()) ?? null) : null;
    const resolvedSourceType = mimeType?.startsWith('video/') ? 'VIDEO' : 'IMAGE';

    let newEntry;
    try {
      newEntry = await (prisma as any).diaryEntry.create({
        data: {
          matchId,
          savedByUserId: userId,
          sourceType: resolvedSourceType,
          content: null,
          attachmentUrl: uploadResult.secureUrl,
          attachmentPublicId: uploadResult.publicId,
          caption: encryptedCaption,
        },
        include: {
          savedBy: {
            select: {
              id: true,
              profile: {
                select: {
                  name: true,
                  photos: { take: 1, select: { secureUrl: true } },
                },
              },
            },
          },
        },
      });
    } catch (dbErr) {
      // If DB insert fails, cleanup Cloudinary asset so no orphaned files remain
      if (uploadResult.publicId) {
        await this.uploadService.deleteAsset(uploadResult.publicId);
      }
      throw dbErr;
    }

    if (match.conversation?.id) {
      io.to(`conversation_${match.conversation.id}`).emit('diary_entry_added', {
        matchId,
        entryId: newEntry.id,
        savedByUserId: userId,
      });
    }

    return {
      id: newEntry.id,
      matchId: newEntry.matchId,
      savedByUserId: newEntry.savedByUserId,
      savedByName: newEntry.savedBy?.profile?.name || 'Partner',
      savedByPhoto: newEntry.savedBy?.profile?.photos?.[0]?.secureUrl || null,
      isMine: true,
      sourceType: newEntry.sourceType,
      content: null,
      attachmentUrl: newEntry.attachmentUrl,
      attachmentPublicId: newEntry.attachmentPublicId,
      caption: caption?.trim() || null,
      createdAt: newEntry.createdAt,
    };
  }

  /**
   * Delete an entry (only allowed by the user who personally saved it).
   */
  async deleteEntry(userId: string, matchId: string, entryId: string) {
    const { match } = await this.verifyMatchParticipant(userId, matchId);

    const entry = await (prisma as any).diaryEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new Error('Diary entry not found');
    }

    if (entry.matchId !== matchId) {
      throw new Error('Entry does not belong to this match');
    }

    if (entry.savedByUserId !== userId) {
      throw new Error('You can only delete diary entries you personally saved');
    }

    if (entry.attachmentPublicId) {
      await this.uploadService.deleteAsset(entry.attachmentPublicId);
    }

    await (prisma as any).diaryEntry.delete({
      where: { id: entryId },
    });

    if (match.conversation?.id) {
      io.to(`conversation_${match.conversation.id}`).emit('diary_entry_deleted', {
        matchId,
        entryId,
        deletedByUserId: userId,
      });
    }

    return { success: true };
  }

  /**
   * Delete all diary entries and images for a match upon unmatch/block/grace-close.
   */
  async deleteDiaryForMatch(matchId: string) {
    try {
      const entries = await (prisma as any).diaryEntry.findMany({
        where: { matchId },
        select: { id: true, attachmentPublicId: true },
      });

      for (const entry of entries) {
        if (entry.attachmentPublicId) {
          await this.uploadService.deleteAsset(entry.attachmentPublicId);
        }
      }

      await (prisma as any).diaryEntry.deleteMany({
        where: { matchId },
      });

      logger.info(`[Diary Cleaned] Deleted ${entries.length} entries for match ${matchId}`);
    } catch (err) {
      logger.warn(`Failed to clean diary for match ${matchId}:`, err);
    }
  }
}
