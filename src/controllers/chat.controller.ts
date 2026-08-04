import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ChatService } from '../services/chat.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { io } from '../socket';

const sendMessageSchema = z.object({
  text: z.string().optional(),
  attachments: z
    .array(
      z.object({
        cloudinaryPublicId: z.string(),
        secureUrl: z.string(),
        fileType: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
        fileName: z.string().optional(),
        fileSize: z.number().optional(),
      })
    )
    .optional(),
}).refine(data => Boolean(data.text && data.text.trim().length > 0) || Boolean(data.attachments && data.attachments.length > 0), {
  message: 'Message must contain either text or attachments',
});

const editMessageSchema = z.object({
  text: z.string().min(1, 'Message text cannot be empty'),
});

const typingSchema = z.object({
  isTyping: z.boolean(),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// In-memory cache for typing status tracking
const typingUsers = new Map<string, Set<string>>();

export class ChatController {
  private chatService = new ChatService();

  getConversations = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const chats = await this.chatService.getConversations(req.user.userId);

      return res.status(200).json({
        success: true,
        data: chats,
      });
    } catch (error: any) {
      logger.error('getConversations controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving conversations failed' });
    }
  };

  getMessages = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const parsed = querySchema.safeParse(req.query);
      const page = parsed.success ? parsed.data.page : 1;
      const limit = parsed.success ? parsed.data.limit : 50;

      const messages = await this.chatService.getMessages(conversationId, req.user.userId, limit, page);

      return res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      logger.error('getMessages controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving messages failed' });
    }
  };

  sendMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const result = sendMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const message = await this.chatService.sendMessage(
        conversationId,
        req.user.userId,
        result.data.text,
        result.data.attachments
      );

      // Automatically clear typing status on send
      const typers = typingUsers.get(conversationId);
      if (typers) {
        typers.delete(req.user.userId);
      }

      // Emit socket message for real-time messaging
      io.to(conversationId).emit('new_message', {
        conversationId,
        message: {
          id: message.id,
          senderId: message.senderId,
          text: message.text,
          isDeleted: message.isDeleted,
          attachments: message.attachments,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message,
      });
    } catch (error: any) {
      logger.error('sendMessage controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Sending message failed' });
    }
  };

  editMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { messageId } = req.params;
      const result = editMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const message = await this.chatService.editMessage(messageId, req.user.userId, result.data.text);

      return res.status(200).json({
        success: true,
        message: 'Message updated successfully',
        data: message,
      });
    } catch (error: any) {
      logger.error('editMessage controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Editing message failed' });
    }
  };

  deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { messageId } = req.params;
      const result = await this.chatService.deleteMessage(messageId, req.user.userId);

      io.to(result.conversationId).emit('message_deleted', {
        conversationId: result.conversationId,
        messageId: result.messageId,
        senderId: result.senderId,
      });

      return res.status(200).json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error: any) {
      logger.error('deleteMessage controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Deleting message failed' });
    }
  };

  deleteConversationMessages = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const result = await this.chatService.deleteConversationMessages(conversationId, req.user.userId);

      io.to(req.user.userId).emit('conversation_cleared', {
        conversationId,
      });

      return res.status(200).json({
        success: true,
        message: 'Chat messages deleted successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error('deleteConversationMessages controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Deleting chat failed' });
    }
  };

  markSeen = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      await this.chatService.markSeen(conversationId, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error: any) {
      logger.error('markSeen controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to mark seen' });
    }
  };

  markDelivered = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const status = await this.chatService.markDelivered(conversationId, req.user.userId);

      return res.status(200).json(status);
    } catch (error: any) {
      logger.error('markDelivered controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to mark delivered' });
    }
  };

  postTyping = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const result = typingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Set<string>());
      }

      const typers = typingUsers.get(conversationId)!;
      if (result.data.isTyping) {
        typers.add(req.user.userId);
      } else {
        typers.delete(req.user.userId);
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('postTyping controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to set typing status' });
    }
  };

  getTyping = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const typersSet = typingUsers.get(conversationId);
      const typingUserIds = typersSet ? Array.from(typersSet).filter(id => id !== req.user!.userId) : [];

      return res.status(200).json({
        success: true,
        typingUserIds,
      });
    } catch (error: any) {
      logger.error('getTyping controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to query typing status' });
    }
  };
}
