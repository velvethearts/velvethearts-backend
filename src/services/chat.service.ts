import { ChatRepository } from '../repositories/chat.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationType } from '@prisma/client';

export class ChatService {
  private chatRepository = new ChatRepository();
  private notificationRepository = new NotificationRepository();

  async getConversations(userId: string) {
    const list = await this.chatRepository.findUserConversations(userId);

    return list.map((c) => {
      const partnerParticipant = c.participants.find((p: any) => p.userId !== userId);
      const userParticipant = c.participants.find((p: any) => p.userId === userId);
      
      const partner = partnerParticipant?.user;
      const prof = partner?.profile;

      const lastMsg = c.messages[0] || null;
      
      // Calculate unread count (messages sent by partner after user's lastReadAt)
      const lastRead = userParticipant?.lastReadAt || new Date(0);
      const unread = c.messages.filter(
        (m: any) => m.senderId !== userId && new Date(m.createdAt) > new Date(lastRead)
      ).length;

      return {
        id: c.id,
        partnerId: partner?.id || '',
        name: prof?.name || 'Velvet Hearts Member',
        photo: prof?.photos?.[0]?.secureUrl || '',
        lastMessage: lastMsg ? (lastMsg.isDeleted ? 'Message deleted' : lastMsg.text) : '',
        lastMessageTime: lastMsg ? lastMsg.createdAt : c.updatedAt,
        unreadCount: unread,
      };
    });
  }

  async getMessages(conversationId: string, userId: string, limit = 50, page = 1) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized chat query');

    // Fetch messages
    const messages = await this.chatRepository.findMessagesByConversation(conversationId, limit, page);

    // Update last read receipt for user
    await this.chatRepository.updateLastRead(conversationId, userId);

    return messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.isDeleted ? 'This message was deleted' : m.text,
      isDeleted: m.isDeleted,
      attachments: m.attachments,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async sendMessage(conversationId: string, senderId: string, text?: string, attachments?: any[]) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === senderId);
    if (!isMember) throw new Error('Unauthorized send message action');

    const message = await this.chatRepository.createMessage(conversationId, senderId, text, attachments);

    // Get the other participant
    const partner = conversation.participants.find((p) => p.userId !== senderId);
    if (partner) {
      await this.notificationRepository.create(
        partner.userId,
        NotificationType.MESSAGE,
        'New message',
        text || 'Sent an attachment',
        conversationId
      );
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

    return this.chatRepository.editMessage(messageId, text);
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
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

  async deleteConversationMessages(conversationId: string, userId: string) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized conversation delete action');

    const result = await this.chatRepository.softDeleteUserMessagesInConversation(conversationId, userId);
    return { success: true, deletedCount: result.count };
  }

  async markSeen(conversationId: string, userId: string) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) throw new Error('Unauthorized conversation action');

    await this.chatRepository.updateLastRead(conversationId, userId);
    return { success: true };
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
