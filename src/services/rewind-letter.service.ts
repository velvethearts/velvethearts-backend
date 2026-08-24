import { prisma } from '../config/database';
import { NotificationType, RewindLetterStatus } from '@prisma/client';
import { io } from '../socket';
import { logger } from '../utils/logger';
import { PushService } from './push.service';
import {
  REWIND_LETTER_DEFAULT_DELIVERY_DAYS,
  REWIND_LETTER_MIN_DELIVERY_DAYS,
  REWIND_LETTER_MAX_DELIVERY_DAYS,
  REWIND_LETTER_EDIT_WINDOW_HOURS,
  REWIND_LETTER_MAX_WORDS,
  REWIND_LETTER_MAX_LENGTH,
} from '../constants/rewind-letter.constants';

export class RewindLetterService {
  private pushService = new PushService();

  private countWords(str: string): number {
    return str.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Write (seal) a rewind letter for a match.
   * Allowed if user doesn't already have an active SEALED letter for this match.
   */
  async writeLetter(authorId: string, matchId: string, content: string, deliveryDays?: number) {
    if (!content || content.trim().length === 0) {
      throw new Error('Letter content cannot be empty');
    }
    const words = this.countWords(content);
    if (words > REWIND_LETTER_MAX_WORDS) {
      throw new Error(`Letter must be ${REWIND_LETTER_MAX_WORDS} words or fewer (currently ${words} words)`);
    }
    if (content.length > REWIND_LETTER_MAX_LENGTH) {
      throw new Error('Letter exceeds maximum allowed length');
    }

    // Validate deliveryDays if supplied
    const days = (typeof deliveryDays === 'number' && Number.isInteger(deliveryDays))
      ? Math.max(REWIND_LETTER_MIN_DELIVERY_DAYS, Math.min(REWIND_LETTER_MAX_DELIVERY_DAYS, deliveryDays))
      : REWIND_LETTER_DEFAULT_DELIVERY_DAYS;

    // Verify match exists, is active, and author is a participant
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.unmatched) throw new Error('This match is no longer active');
    if (match.user1Id !== authorId && match.user2Id !== authorId) {
      throw new Error('You are not part of this match');
    }

    // Check author doesn't already have an active SEALED letter for this match
    const existingSealed = await prisma.rewindLetter.findFirst({
      where: { matchId, authorId, status: RewindLetterStatus.SEALED },
    });
    if (existingSealed) {
      throw new Error('You already have a sealed letter waiting for delivery in this chat');
    }

    // Compute deliverAfter: now (letter creation time) + days
    const deliverAfter = new Date();
    deliverAfter.setDate(deliverAfter.getDate() + days);

    const letter = await prisma.rewindLetter.create({
      data: {
        matchId,
        authorId,
        content: content.trim(),
        deliverAfter,
        status: RewindLetterStatus.SEALED,
      },
    });

    // Partner info for notification and real-time sync
    const partnerId = match.user1Id === authorId ? match.user2Id : match.user1Id;
    const partnerProfile = await prisma.profile.findUnique({
      where: { userId: partnerId },
      select: { name: true },
    });

    // Create an in-app confirmation notification for the author
    try {
      const notif = await prisma.notification.create({
        data: {
          userId: authorId,
          type: NotificationType.REWIND_LETTER,
          title: 'Letter Sealed ✉️',
          content: `Your private Rewind Letter for ${partnerProfile?.name || 'your match'} is safely sealed.`,
          relatedId: matchId,
        },
      });

      if (io) {
        io.to(authorId).emit('notification', { notification: notif });
        io.to(authorId).emit('rewind_letter_sealed', { matchId, letterId: letter.id, isAuthor: true });
        io.to(partnerId).emit('rewind_letter_sealed', { matchId, letterId: letter.id, isAuthor: false });
      }
    } catch (e) {
      logger.warn('[RewindLetter] Failed to create sealed notification:', e);
    }

    // Inject a unique Rewind Capsule card message directly into the chat conversation
    try {
      let conversation = await prisma.conversation.findUnique({
        where: { matchId },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            matchId,
            participants: {
              create: [
                { userId: authorId },
                { userId: partnerId },
              ],
            },
          },
        });
      }

      const chatMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: authorId,
          text: '__REWIND_CAPSULE__',
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      if (io) {
        const socketPayload = {
          conversationId: conversation.id,
          message: {
            id: chatMessage.id,
            senderId: chatMessage.senderId,
            text: chatMessage.text,
            isEdited: false,
            isDeleted: false,
            attachments: [],
            createdAt: chatMessage.createdAt,
            updatedAt: chatMessage.updatedAt,
          },
        };
        io.to(partnerId).emit('new_message', socketPayload);
        io.to(authorId).emit('new_message', socketPayload);
      }
    } catch (msgErr) {
      logger.warn('[RewindLetter] Failed to inject capsule chat message:', msgErr);
    }

    logger.info(`[RewindLetter] Letter sealed by ${authorId} for match ${matchId} (unlock in ${days} days)`);
    return {
      id: letter.id,
      matchId: letter.matchId,
      status: letter.status,
      content: letter.content,
      deliverAfter: letter.deliverAfter,
      createdAt: letter.createdAt,
    };
  }

  /**
   * Edit letter content (and optionally delivery timeframe) within the 48-hour window.
   */
  async editLetterContent(authorId: string, matchId: string, content: string, deliveryDays?: number, letterId?: string) {
    const letter = letterId
      ? await prisma.rewindLetter.findFirst({ where: { id: letterId, authorId, matchId }, include: { match: true } })
      : await prisma.rewindLetter.findFirst({ where: { matchId, authorId, status: RewindLetterStatus.SEALED }, include: { match: true } });

    if (!letter) {
      throw new Error('Letter not found');
    }
    if (letter.status !== RewindLetterStatus.SEALED) {
      throw new Error('Delivered letters cannot be edited');
    }

    const elapsedHours = (Date.now() - new Date(letter.createdAt).getTime()) / (1000 * 60 * 60);
    if (elapsedHours > REWIND_LETTER_EDIT_WINDOW_HOURS) {
      throw new Error(`Letters can only be edited within ${REWIND_LETTER_EDIT_WINDOW_HOURS} hours of sending`);
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Letter content cannot be empty');
    }
    const words = this.countWords(content);
    if (words > REWIND_LETTER_MAX_WORDS) {
      throw new Error(`Letter must be ${REWIND_LETTER_MAX_WORDS} words or fewer (currently ${words} words)`);
    }
    if (content.length > REWIND_LETTER_MAX_LENGTH) {
      throw new Error('Letter exceeds maximum allowed length');
    }

    let deliverAfter = letter.deliverAfter;
    if (typeof deliveryDays === 'number' && Number.isInteger(deliveryDays)) {
      const days = Math.max(REWIND_LETTER_MIN_DELIVERY_DAYS, Math.min(REWIND_LETTER_MAX_DELIVERY_DAYS, deliveryDays));
      deliverAfter = new Date(letter.createdAt);
      deliverAfter.setDate(deliverAfter.getDate() + days);
    }

    const updated = await prisma.rewindLetter.update({
      where: { id: letter.id },
      data: {
        content: content.trim(),
        deliverAfter,
      },
    });

    const partnerId = letter.match.user1Id === authorId ? letter.match.user2Id : letter.match.user1Id;
    if (io) {
      io.to(authorId).emit('rewind_letter_updated', { matchId, letterId: updated.id, isAuthor: true });
      io.to(partnerId).emit('rewind_letter_updated', { matchId, letterId: updated.id, isAuthor: false });
    }

    logger.info(`[RewindLetter] Letter ${letter.id} edited by author ${authorId}`);
    return {
      id: updated.id,
      matchId: updated.matchId,
      content: updated.content,
      deliverAfter: updated.deliverAfter,
      status: updated.status,
    };
  }

  /**
   * Reschedule delivery time for an already sealed letter.
   * Allowed only while letter is in SEALED state.
   */
  async updateDeliverySchedule(authorId: string, matchId: string, deliveryDays: number, letterId?: string) {
    if (!Number.isInteger(deliveryDays) || deliveryDays < REWIND_LETTER_MIN_DELIVERY_DAYS || deliveryDays > REWIND_LETTER_MAX_DELIVERY_DAYS) {
      throw new Error(`Unlock duration must be between ${REWIND_LETTER_MIN_DELIVERY_DAYS} and ${REWIND_LETTER_MAX_DELIVERY_DAYS} days`);
    }

    const letter = letterId
      ? await prisma.rewindLetter.findFirst({ where: { id: letterId, authorId, matchId }, include: { match: true } })
      : await prisma.rewindLetter.findFirst({ where: { matchId, authorId, status: RewindLetterStatus.SEALED }, include: { match: true } });

    if (!letter) {
      throw new Error('Letter not found');
    }
    if (letter.status !== RewindLetterStatus.SEALED) {
      throw new Error('Only sealed letters can be rescheduled');
    }

    const deliverAfter = new Date(letter.createdAt);
    deliverAfter.setDate(deliverAfter.getDate() + deliveryDays);

    const updated = await prisma.rewindLetter.update({
      where: { id: letter.id },
      data: { deliverAfter },
    });

    const partnerId = letter.match.user1Id === authorId ? letter.match.user2Id : letter.match.user1Id;
    if (io) {
      io.to(authorId).emit('rewind_letter_updated', { matchId, letterId: updated.id, isAuthor: true });
      io.to(partnerId).emit('rewind_letter_updated', { matchId, letterId: updated.id, isAuthor: false });
    }

    logger.info(`[RewindLetter] Delivery rescheduled for letter ${letter.id} to ${deliverAfter.toISOString()}`);
    return {
      id: updated.id,
      matchId: updated.matchId,
      deliverAfter: updated.deliverAfter,
      status: updated.status,
    };
  }

  /**
   * Delete / unsend a letter (either by specific letter ID or active sealed letter).
   */
  async deleteLetter(authorId: string, matchId: string, letterId?: string) {
    const letter = letterId
      ? await prisma.rewindLetter.findFirst({ where: { id: letterId, authorId, matchId }, include: { match: true } })
      : await prisma.rewindLetter.findFirst({ where: { matchId, authorId }, orderBy: { createdAt: 'desc' }, include: { match: true } });

    if (!letter) {
      throw new Error('Letter not found');
    }

    await prisma.rewindLetter.delete({
      where: { id: letter.id },
    });

    const partnerId = letter.match.user1Id === authorId ? letter.match.user2Id : letter.match.user1Id;
    if (io) {
      io.to(authorId).emit('rewind_letter_deleted', { matchId, letterId: letter.id, isAuthor: true });
      io.to(partnerId).emit('rewind_letter_deleted', { matchId, letterId: letter.id, isAuthor: false });
    }

    logger.info(`[RewindLetter] Letter ${letter.id} deleted by author ${authorId}`);
    return { success: true, message: 'Letter deleted successfully' };
  }

  /**
   * Get the status and full history of rewind letters for a match.
   * Returns all sent letters and all received letters (sanitizing content for sealed letters).
   */
  async getLetterStatus(userId: string, matchId: string) {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('You are not part of this match');
    }

    const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;

    // All letters written BY this user (sent tab history)
    const sentLetters = await prisma.rewindLetter.findMany({
      where: { matchId, authorId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        content: true,
        createdAt: true,
        deliverAfter: true,
        deliveredAt: true,
      },
    });

    // All letters written BY partner for this user (received tab history)
    const rawReceivedLetters = await prisma.rewindLetter.findMany({
      where: { matchId, authorId: partnerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        content: true,
        createdAt: true,
        deliverAfter: true,
        deliveredAt: true,
      },
    });

    // Sanitize received letters: only DELIVERED letters have readable content
    const receivedLetters = rawReceivedLetters.map((letter) => ({
      id: letter.id,
      status: letter.status,
      createdAt: letter.createdAt,
      deliverAfter: letter.deliverAfter,
      deliveredAt: letter.deliveredAt,
      content: letter.status === RewindLetterStatus.DELIVERED ? letter.content : null,
    }));

    // Most relevant active letters
    const myLetter = sentLetters.find((l) => l.status === RewindLetterStatus.SEALED) || sentLetters[0] || null;
    const receivedLetter = receivedLetters.find((l) => l.status === RewindLetterStatus.SEALED)
      || receivedLetters.find((l) => l.status === RewindLetterStatus.DELIVERED)
      || receivedLetters[0]
      || null;

    return {
      myLetter,
      receivedLetter,
      sentLetters,
      receivedLetters,
    };
  }

  /**
   * Get the content of the most recently delivered letter from partner.
   */
  async getDeliveredLetter(userId: string, matchId: string) {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('You are not part of this match');
    }

    const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
    const letter = await prisma.rewindLetter.findFirst({
      where: { matchId, authorId: partnerId, status: RewindLetterStatus.DELIVERED },
      orderBy: { deliveredAt: 'desc' },
    });

    if (!letter) throw new Error('No delivered letter found for this match');

    const authorProfile = await prisma.profile.findUnique({
      where: { userId: partnerId },
      select: { name: true },
    });

    return {
      id: letter.id,
      content: letter.content,
      authorName: authorProfile?.name || 'Your match',
      deliveredAt: letter.deliveredAt,
      createdAt: letter.createdAt,
    };
  }

  /**
   * Void all sealed letters for a match (called during unmatch/block/grace-close).
   */
  async voidLettersByMatch(matchId: string) {
    await prisma.rewindLetter.updateMany({
      where: { matchId, status: RewindLetterStatus.SEALED },
      data: { status: RewindLetterStatus.VOIDED },
    });
  }

  /**
   * Scheduled sweep: deliver letters whose deliverAfter deadline has passed.
   */
  async sweepAndDeliverLetters() {
    const now = new Date();

    const timeReady = await prisma.rewindLetter.findMany({
      where: {
        status: RewindLetterStatus.SEALED,
        deliverAfter: { lte: now },
      },
      include: { match: true },
    });

    if (timeReady.length === 0) return;

    for (const letter of timeReady) {
      try {
        await prisma.rewindLetter.update({
          where: { id: letter.id },
          data: {
            status: RewindLetterStatus.DELIVERED,
            deliveredAt: now,
          },
        });

        const recipientId = letter.match.user1Id === letter.authorId
          ? letter.match.user2Id
          : letter.match.user1Id;

        const authorProfile = await prisma.profile.findUnique({
          where: { userId: letter.authorId },
          select: { name: true },
        });

        const recipientProfile = await prisma.profile.findUnique({
          where: { userId: recipientId },
          select: { name: true },
        });

        const recipientNotif = await prisma.notification.create({
          data: {
            userId: recipientId,
            type: NotificationType.REWIND_LETTER,
            title: 'A letter arrives ✉️',
            content: `${authorProfile?.name || 'Your match'} wrote you a Rewind Letter when you first connected.`,
            relatedId: letter.matchId,
          },
        });

        const authorNotif = await prisma.notification.create({
          data: {
            userId: letter.authorId,
            type: NotificationType.REWIND_LETTER,
            title: 'Letter Delivered ✉️',
            content: `Your Rewind Letter has been delivered to ${recipientProfile?.name || 'your match'}.`,
            relatedId: letter.matchId,
          },
        });

        if (io) {
          io.to(recipientId).emit('rewind_letter_delivered', {
            matchId: letter.matchId,
            letterId: letter.id,
            authorName: authorProfile?.name || 'Your match',
            isAuthor: false,
          });
          io.to(recipientId).emit('notification', {
            notification: recipientNotif,
          });

          io.to(letter.authorId).emit('rewind_letter_delivered', {
            matchId: letter.matchId,
            letterId: letter.id,
            partnerName: recipientProfile?.name || 'Your match',
            isAuthor: true,
          });
          io.to(letter.authorId).emit('notification', {
            notification: authorNotif,
          });
        }

        this.pushService.sendPushNotification(recipientId, {
          title: 'A letter arrives ✉️',
          body: `${authorProfile?.name || 'Your match'} wrote you a Rewind Letter when you first connected.`,
          url: '/?tab=chat',
          data: { tab: 'chat', matchId: letter.matchId }
        }).catch(() => {});

        this.pushService.sendPushNotification(letter.authorId, {
          title: 'Letter Delivered ✉️',
          body: `Your Rewind Letter has been delivered to ${recipientProfile?.name || 'your match'}.`,
          url: '/?tab=chat',
          data: { tab: 'chat', matchId: letter.matchId }
        }).catch(() => {});

        logger.info(`[RewindLetter] Delivered letter ${letter.id} to user ${recipientId} and notified author ${letter.authorId}`);
      } catch (err: any) {
        logger.error(`[RewindLetter] Failed to deliver letter ${letter.id}:`, err?.message || err);
      }
    }
  }
}
