import { prisma } from '../config/database';
import { Conversation, Message, ConversationParticipant, FileType } from '@prisma/client';

export class ChatRepository {
  async findOrCreateConversation(matchId: string, participantIds: string[]): Promise<Conversation & { participants: ConversationParticipant[] }> {
    const existing = await prisma.conversation.findUnique({
      where: { matchId },
      include: {
        participants: true,
      },
    });

    if (existing) return existing as any;

    return prisma.conversation.create({
      data: {
        matchId,
        participants: {
          create: participantIds.map((pId) => ({
            userId: pId,
          })),
        },
      },
      include: {
        participants: true,
      },
    });
  }

  async findConversationById(id: string): Promise<(Conversation & { participants: ConversationParticipant[] }) | null> {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });
  }

  async findConversationByTarget(userId: string, targetId: string): Promise<(Conversation & { participants: ConversationParticipant[] }) | null> {
    // 1. Try finding by conversation ID
    let conv = await prisma.conversation.findUnique({
      where: { id: targetId },
      include: { participants: true },
    });
    if (conv) return conv;

    // 2. Try finding by matchId
    conv = await prisma.conversation.findUnique({
      where: { matchId: targetId },
      include: { participants: true },
    });
    if (conv) return conv;

    // 3. Try finding by partner userId in participants
    conv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetId } } },
        ],
      },
      include: { participants: true },
    });
    if (conv) return conv;

    // 4. Fallback: check if active match exists between userId and targetId
    const [u1, u2] = [userId, targetId].sort();
    const match = await prisma.match.findFirst({
      where: {
        user1Id: u1,
        user2Id: u2,
        unmatched: false,
      },
    });

    if (match) {
      return this.findOrCreateConversation(match.id, [userId, targetId]);
    }

    return null;
  }

  async findUserConversations(userId: string): Promise<any[]> {
    return prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
        match: {
          unmatched: false,
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: {
                  include: {
                    photos: {
                      orderBy: { photoOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    text?: string,
    attachments?: { cloudinaryPublicId: string; secureUrl: string; fileType: FileType; fileName?: string; fileSize?: number }[]
  ): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId,
          text: text && text.trim() ? text.trim() : null,
          attachments: attachments
            ? {
                create: attachments.map((att) => ({
                  cloudinaryPublicId: att.cloudinaryPublicId,
                  secureUrl: att.secureUrl,
                  fileType: att.fileType,
                  fileName: att.fileName,
                  fileSize: att.fileSize,
                })),
              }
            : undefined,
        },
        include: {
          attachments: true,
        },
      });

      // Update conversation updatedAt timestamp
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Automatically update sender's last read receipt
      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: senderId,
          },
        },
        data: { lastReadAt: new Date() },
      });

      return message;
    });
  }

  async findMessageById(id: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: { id },
    });
  }

  async findMessagesByConversation(conversationId: string, limit = 50, page = 1): Promise<any[]> {
    const skip = (page - 1) * limit;
    return prisma.message.findMany({
      where: { conversationId },
      include: {
        attachments: true,
        reactions: true,
      },
      orderBy: { createdAt: 'desc' }, // newest messages first for paginated messaging history
      take: limit,
      skip,
    });
  }

  async editMessage(messageId: string, text: string): Promise<Message> {
    return prisma.message.update({
      where: { id: messageId },
      data: {
        text,
        isEdited: true,
        updatedAt: new Date(),
      },
    });
  }

  async updateLastRead(conversationId: string, userId: string): Promise<ConversationParticipant> {
    return prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: { lastReadAt: new Date() },
    });
  }

  async softDeleteMessage(messageId: string): Promise<Message> {
    return prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async softDeleteUserMessagesInConversation(conversationId: string, _senderId?: string): Promise<{ count: number }> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.message.updateMany({
        where: {
          conversationId,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return { count: result.count };
    });
  }
}
