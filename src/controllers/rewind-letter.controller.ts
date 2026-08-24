import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RewindLetterService } from '../services/rewind-letter.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import {
  REWIND_LETTER_MAX_LENGTH,
  REWIND_LETTER_MIN_DELIVERY_DAYS,
  REWIND_LETTER_MAX_DELIVERY_DAYS,
} from '../constants/rewind-letter.constants';

const writeLetterSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
  content: z.string().min(1, 'Letter cannot be empty').max(REWIND_LETTER_MAX_LENGTH, `Letter must be ${REWIND_LETTER_MAX_LENGTH} characters or fewer`),
  deliveryDays: z.number().int().min(REWIND_LETTER_MIN_DELIVERY_DAYS, `Unlock duration must be at least ${REWIND_LETTER_MIN_DELIVERY_DAYS} days`).max(REWIND_LETTER_MAX_DELIVERY_DAYS, `Unlock duration cannot exceed ${REWIND_LETTER_MAX_DELIVERY_DAYS} days`).optional(),
});

const editLetterSchema = z.object({
  content: z.string().min(1, 'Letter cannot be empty').max(REWIND_LETTER_MAX_LENGTH, `Letter must be ${REWIND_LETTER_MAX_LENGTH} characters or fewer`),
  deliveryDays: z.number().int().min(REWIND_LETTER_MIN_DELIVERY_DAYS, `Unlock duration must be at least ${REWIND_LETTER_MIN_DELIVERY_DAYS} days`).max(REWIND_LETTER_MAX_DELIVERY_DAYS, `Unlock duration cannot exceed ${REWIND_LETTER_MAX_DELIVERY_DAYS} days`).optional(),
});

const updateScheduleSchema = z.object({
  deliveryDays: z.number().int().min(REWIND_LETTER_MIN_DELIVERY_DAYS, `Unlock duration must be at least ${REWIND_LETTER_MIN_DELIVERY_DAYS} days`).max(REWIND_LETTER_MAX_DELIVERY_DAYS, `Unlock duration cannot exceed ${REWIND_LETTER_MAX_DELIVERY_DAYS} days`),
});

export class RewindLetterController {
  private rewindLetterService = new RewindLetterService();

  write = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = writeLetterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const data = await this.rewindLetterService.writeLetter(
        req.user.userId,
        result.data.matchId,
        result.data.content,
        result.data.deliveryDays
      );

      return res.status(201).json({
        success: true,
        message: 'Your letter has been sealed',
        data,
      });
    } catch (error: any) {
      logger.error('Write rewind letter controller failure:', error);
      const status = error.message?.includes('not found') ? 404
        : error.message?.includes('already written') ? 409
        : 500;
      return res.status(status).json({ success: false, message: error.message || 'Writing letter failed' });
    }
  };

  edit = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!matchId) {
        return res.status(400).json({ success: false, message: 'Match ID is required' });
      }

      const result = editLetterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const data = await this.rewindLetterService.editLetterContent(
        req.user.userId,
        matchId,
        result.data.content,
        result.data.deliveryDays
      );

      return res.status(200).json({
        success: true,
        message: 'Letter updated successfully',
        data,
      });
    } catch (error: any) {
      logger.error('Edit rewind letter controller failure:', error);
      const status = error.message?.includes('not found') ? 404
        : error.message?.includes('Delivered') || error.message?.includes('within') ? 400
        : 500;
      return res.status(status).json({ success: false, message: error.message || 'Editing letter failed' });
    }
  };

  updateSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!matchId) {
        return res.status(400).json({ success: false, message: 'Match ID is required' });
      }

      const result = updateScheduleSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const data = await this.rewindLetterService.updateDeliverySchedule(
        req.user.userId,
        matchId,
        result.data.deliveryDays
      );

      return res.status(200).json({
        success: true,
        message: 'Delivery schedule updated',
        data,
      });
    } catch (error: any) {
      logger.error('Update rewind letter schedule controller failure:', error);
      const status = error.message?.includes('not found') ? 404
        : error.message?.includes('Only sealed') ? 400
        : 500;
      return res.status(status).json({ success: false, message: error.message || 'Updating schedule failed' });
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!matchId) {
        return res.status(400).json({ success: false, message: 'Match ID is required' });
      }

      const data = await this.rewindLetterService.deleteLetter(
        req.user.userId,
        matchId
      );

      return res.status(200).json(data);
    } catch (error: any) {
      logger.error('Delete rewind letter controller failure:', error);
      const status = error.message?.includes('not found') ? 404
        : error.message?.includes('Delivered') ? 400
        : 500;
      return res.status(status).json({ success: false, message: error.message || 'Deleting letter failed' });
    }
  };

  getStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!matchId) {
        return res.status(400).json({ success: false, message: 'Match ID is required' });
      }

      const data = await this.rewindLetterService.getLetterStatus(req.user.userId, matchId);

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error('Get rewind letter status controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving letter status failed' });
    }
  };

  getDelivered = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!matchId) {
        return res.status(400).json({ success: false, message: 'Match ID is required' });
      }

      const data = await this.rewindLetterService.getDeliveredLetter(req.user.userId, matchId);

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error('Get delivered rewind letter controller failure:', error);
      const status = error.message?.includes('not found') ? 404
        : error.message?.includes('not been delivered') ? 403
        : 500;
      return res.status(status).json({ success: false, message: error.message || 'Retrieving letter failed' });
    }
  };
}
