import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { PushService } from '../services/push.service';
import { logger } from '../utils/logger';

export class PushController {
  private pushService = new PushService();

  getVapidPublicKey = async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const publicKey = this.pushService.getVapidPublicKey();
      return res.status(200).json({
        success: true,
        data: { publicKey },
      });
    } catch (error: any) {
      logger.error('getVapidPublicKey controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get VAPID key' });
    }
  };

  subscribe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { subscription } = req.body;
      await this.pushService.subscribe(req.user.userId, subscription);

      return res.status(200).json({
        success: true,
        message: 'Push notification subscription saved successfully',
      });
    } catch (error: any) {
      logger.error('subscribe controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to save push subscription' });
    }
  };

  unsubscribe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await this.pushService.unsubscribe(endpoint);
      }

      return res.status(200).json({
        success: true,
        message: 'Unsubscribed from push notifications',
      });
    } catch (error: any) {
      logger.error('unsubscribe controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to unsubscribe' });
    }
  };
}
