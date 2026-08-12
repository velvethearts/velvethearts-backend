import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SafetyService } from '../services/safety.service';
import { blockSchema, reportSchema } from '../validators/safety.validator';
import { logger } from '../utils/logger';

export class SafetyController {
  private safetyService = new SafetyService();

  block = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = blockSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      await this.safetyService.blockUser(
        req.user.userId,
        result.data.blockedUserId,
        result.data.reason
      );

      return res.status(200).json({
        success: true,
        message: 'User blocked successfully',
      });
    } catch (error: any) {
      logger.error('Block controller failure:', error);
      return res.status(500).json({ success: false, message: 'Blocking user failed' });
    }
  };

  report = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = reportSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      await this.safetyService.reportUser(
        req.user.userId,
        result.data.targetUserId,
        result.data.reason,
        result.data.comment
      );

      return res.status(200).json({
        success: true,
        message: 'Report submitted successfully. Target user has been auto-blocked.',
      });
    } catch (error: any) {
      logger.error('Report controller failure:', error);
      return res.status(500).json({ success: false, message: 'Submitting report failed' });
    }
  };

  unblock = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const blockedUserId = req.params.blockedUserId || req.body?.blockedUserId;
      if (!blockedUserId) {
        return res.status(400).json({ success: false, message: 'Blocked user ID is required' });
      }

      await this.safetyService.unblockUser(req.user.userId, blockedUserId);

      return res.status(200).json({
        success: true,
        message: 'User unblocked successfully',
      });
    } catch (error: any) {
      logger.error('Unblock controller failure:', error);
      return res.status(500).json({ success: false, message: 'Unblocking user failed' });
    }
  };

  getBlockedUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const blockedUsers = await this.safetyService.getBlockedUsers(req.user.userId);

      return res.status(200).json({
        success: true,
        data: blockedUsers,
      });
    } catch (error: any) {
      logger.error('Get blocked users controller failure:', error);
      return res.status(500).json({ success: false, message: 'Fetching blocked users failed' });
    }
  };
}
