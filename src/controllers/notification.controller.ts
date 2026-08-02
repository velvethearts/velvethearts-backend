import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export class NotificationController {
  private notificationService = new NotificationService();

  getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const parsed = querySchema.safeParse(req.query);
      const page = parsed.success ? parsed.data.page : 1;
      const limit = parsed.success ? parsed.data.limit : 20;

      const result = await this.notificationService.getNotifications(req.user.userId, page, limit);

      return res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('getNotifications controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch notifications' });
    }
  };

  markRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;
      await this.notificationService.markAsRead(id, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      logger.error('markRead controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update notification' });
    }
  };

  markAllRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      await this.notificationService.markAllAsRead(req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      logger.error('markAllRead controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to clear notifications' });
    }
  };

  deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;
      await this.notificationService.deleteNotification(id, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error: any) {
      logger.error('deleteNotification controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete notification' });
    }
  };
}
