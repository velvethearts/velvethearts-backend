import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { MatchService } from '../services/match.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const likeSchema = z.object({
  receiverId: z.string().uuid('Invalid profile user ID'),
  isSuper: z.boolean().optional().default(false),
  comment: z.string().max(500).optional().nullable(),
});

const unmatchSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
});

export class MatchController {
  private matchService = new MatchService();

  like = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = likeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const data = await this.matchService.likeProfile(
        req.user.userId,
        result.data.receiverId,
        result.data.isSuper,
        result.data.comment || null
      );

      return res.status(200).json({
        success: true,
        message: data.match ? "It's a Match!" : 'Interest sent successfully',
        data,
      });
    } catch (error: any) {
      logger.error('Like profile controller failure:', error);
      return res.status(500).json({ success: false, message: 'Liking profile failed' });
    }
  };

  unlike = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = likeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const data = await this.matchService.unlikeProfile(req.user.userId, result.data.receiverId);

      return res.status(200).json({
        success: true,
        message: 'Like undone successfully',
        data,
      });
    } catch (error: any) {
      logger.error('Unlike profile controller failure:', error);
      return res.status(500).json({ success: false, message: 'Undoing like failed' });
    }
  };

  unmatch = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = unmatchSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const data = await this.matchService.unmatch(req.user.userId, result.data.matchId);

      return res.status(200).json({
        success: true,
        message: 'Unmatched user successfully',
        data,
      });
    } catch (error: any) {
      logger.error('Unmatch controller failure:', error);
      return res.status(500).json({ success: false, message: 'Unmatching failed' });
    }
  };

  getConnections = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const connections = await this.matchService.getConnections(req.user.userId);

      return res.status(200).json({
        success: true,
        data: connections,
      });
    } catch (error: any) {
      logger.error('getConnections controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving connections failed' });
    }
  };

  getReceivedInvites = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const invites = await this.matchService.getReceivedInvites(req.user.userId);

      return res.status(200).json({
        success: true,
        data: invites,
      });
    } catch (error: any) {
      logger.error('getReceivedInvites controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving received invites failed' });
    }
  };

  getSentInvites = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const invites = await this.matchService.getSentInvites(req.user.userId);

      return res.status(200).json({
        success: true,
        data: invites,
      });
    } catch (error: any) {
      logger.error('getSentInvites controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving sent invites failed' });
    }
  };
}
