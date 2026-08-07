import { ChatRepository } from '../repositories/chat.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { BlockRepository } from '../repositories/block.repository';
import { io } from '../socket';
import { prisma } from '../config/database';

import { PushService } from './push.service';

export class ChatService {
  private chatRepository = new ChatRepository();
  private notificationRepository = new NotificationRepository();
  private blockRepository = new BlockRepository();
  private pushService = new PushService();

  async getConversations(userId: string) {
    const list = await this.chatRepository.findUserConversations(userId);
    const blockedUserIds = new Set(await this.blockRepository.findBlockedUserIds(userId));

    return list
      .filter((c) => {
        const partnerParticipant = c.participants.find((p: any) => p.userId !== userId);
        return partnerParticipant && !blockedUserIds.has(partnerParticipant.userId);
      })
      .map((c) => {
        const partnerParticipant = c.participants.find((p: any) => p.userId !== userId);
        const userParticipant = c.participants.find((p: any) => p.userId === userId);
        
        const partner = partnerParticipant?.user;
        const prof = partner?.profile;

        const activeMessages = c.messages.filter((m: any) => !m.isDeleted);
        const lastMsg = activeMessages[0] || null;
        
        let lastMsgText = '';
        if (lastMsg) {
          if (lastMsg.text) {
            lastMsgText = lastMsg.text;
          } else if (Array.isArray(lastMsg.attachments) && lastMsg.attachments.length > 0) {
            const firstAtt = lastMsg.attachments[0];
            lastMsgText = firstAtt.fileType === 'AUDIO' ? '🎤 Voice note' : 'Sent an attachment';
          }
        }
        
        // Calculate unread count (messages sent by partner after user's lastReadAt)
        const lastRead = userParticipant?.lastReadAt || new Date(0);
        const unread = activeMessages.filter(
          (m: any) => m.senderId !== userId && new Date(m.createdAt) > new Date(lastRead)
        ).length;

        return {
          id: c.id,
          partnerId: partner?.id || '',
          name: prof?.name || 'Velvet Hearts Member',
          photo: prof?.photos?.[0]?.secureUrl || '',
          lastMessage: lastMsgText,
          lastMessageTime: lastMsg ? lastMsg.createdAt : c.updatedAt,
          unreadCount: unread,
        };
      });
  }

  async getMessages(conversationId: string, userId: string, limit = 50, page = 1) {
    const conversation = await this.chatRepository.findConversationByTarget(userId, conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized chat query');

    const partner = conversation.participants.find((p) => p.userId !== userId);
    if (partner) {
      const blockedUserIds = new Set(await this.blockRepository.findBlockedUserIds(userId));
      if (blockedUserIds.has(partner.userId)) {
        throw new Error('Cannot access chat with a blocked user');
      }
    }

    // Fetch messages using canonical conversation.id
    const messages = await this.chatRepository.findMessagesByConversation(conversation.id, limit, page);

    // Update last read receipt for user
    await this.chatRepository.updateLastRead(conversation.id, userId);

    const partnerLastReadAt = partner?.lastReadAt ? new Date(partner.lastReadAt) : null;
    const seenAt = new Date().toISOString();

    // Emit real-time read receipt to partner if online
    if (io && partner) {
      const seenPayload = {
        conversationId: conversation.id,
        readerId: userId,
        seenAt,
      };
      io.to(conversation.id).emit('messages_seen', seenPayload);
      io.to(partner.userId).emit('messages_seen', seenPayload);
    }

    return messages
      .filter((m) => !m.isDeleted)
      .map((m) => {
        const isSeen = m.senderId === userId && partnerLastReadAt ? partnerLastReadAt >= new Date(m.createdAt) : false;
        return {
          id: m.id,
          senderId: m.senderId,
          text: m.text,
          isEdited: Boolean(m.isEdited),
          isDeleted: m.isDeleted,
          attachments: m.attachments,
          seen: isSeen,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        };
      });
  }

  async sendMessage(targetConversationId: string, senderId: string, text?: string, attachments?: any[]) {
    const conversation = await this.chatRepository.findConversationByTarget(senderId, targetConversationId);
    if (!conversation) throw new Error('Conversation not found');

    const conversationId = conversation.id;

    const isMember = conversation.participants.some((p) => p.userId === senderId);
    if (!isMember) throw new Error('Unauthorized send message action');

    const partner = conversation.participants.find((p) => p.userId !== senderId);
    if (partner) {
      const blockedUserIds = new Set(await this.blockRepository.findBlockedUserIds(senderId));
      if (blockedUserIds.has(partner.userId)) {
        throw new Error('Cannot send messages to a blocked user');
      }
    }

    const message = await this.chatRepository.createMessage(conversationId, senderId, text, attachments);

    if (partner) {
      try {
        if (io) {
          const socketMessagePayload = {
            conversationId,
            message: {
              id: message.id,
              senderId: message.senderId,
              text: message.text,
              isEdited: Boolean(message.isEdited),
              isDeleted: message.isDeleted,
              attachments: message.attachments,
              createdAt: message.createdAt,
              updatedAt: message.updatedAt,
            }
          };
          io.to(partner.userId).emit('new_message', socketMessagePayload);
          io.to(senderId).emit('new_message', socketMessagePayload);
        }

        // Web Push notification to partner
        const pushBody = text || (Array.isArray(attachments) && attachments.some((a: any) => a.fileType === 'AUDIO') ? '🎤 Sent a voice note' : 'Sent an attachment');
        this.pushService.sendPushNotification(partner.userId, {
          title: 'New Message',
          body: pushBody,
          url: '/chat',
          data: { conversationId, senderId }
        }).catch(() => {});
      } catch (e) {
        // Logging skipped here to avoid pulling logger dependency into this service
      }
    }

    return message;
  }

  async editMessage(messageId: string, userId: string, text: string) {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('Unauthorized message edit action');
    }

    if (message.isDeleted) {
      throw new Error('Cannot edit a deleted message');
    }

    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    if (Date.now() - new Date(message.createdAt).getTime() > FIFTEEN_MINUTES_MS) {
      throw new Error('Messages can only be edited within 15 minutes of sending');
    }

    return this.chatRepository.editMessage(messageId, text);
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      return {
        success: true,
        messageId,
        conversationId: '',
        senderId: userId,
      };
    }

    if (message.senderId !== userId) {
      throw new Error('Unauthorized message delete action');
    }

    const deleted = await this.chatRepository.softDeleteMessage(messageId);
    return {
      success: true,
      messageId: deleted.id,
      conversationId: deleted.conversationId,
      senderId: deleted.senderId,
    };
  }

  async deleteConversationMessages(conversationIdOrPartnerId: string, userId: string) {
    let conversation = await this.chatRepository.findConversationById(conversationIdOrPartnerId);

    if (!conversation) {
      // Check if conversationIdOrPartnerId is a target Profile ID or User ID
      const profile = await prisma.profile.findUnique({ where: { id: conversationIdOrPartnerId } });
      const targetUserId = profile ? profile.userId : conversationIdOrPartnerId;

      const userConvs = await prisma.conversation.findMany({
        where: {
          participants: {
            some: { userId },
          },
        },
        include: { participants: true },
      });

      conversation = userConvs.find((c) => c.participants.some((p) => p.userId === targetUserId)) || null;
    }

    if (!conversation) {
      return { success: true, deletedCount: 0 };
    }

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized conversation delete action');

    const result = await this.chatRepository.softDeleteUserMessagesInConversation(conversation.id, userId);
    return { success: true, deletedCount: result.count };
  }

  async markSeen(conversationId: string, userId: string) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized conversation action');

    await this.chatRepository.updateLastRead(conversationId, userId);
    await this.notificationRepository.markByRelatedId(conversationId, userId);

    const partner = conversation.participants.find((p) => p.userId !== userId);
    const seenAt = new Date().toISOString();

    if (io && partner) {
      const seenPayload = {
        conversationId,
        readerId: userId,
        seenAt,
      };
      io.to(conversationId).emit('messages_seen', seenPayload);
      io.to(partner.userId).emit('messages_seen', seenPayload);
    }

    return { success: true, seenAt };
  }

  async markDelivered(conversationId: string, userId: string) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized conversation action');

    // Messages are delivered immediately to DB. Return success metadata.
    return { success: true, deliveredAt: new Date() };
  }
}
