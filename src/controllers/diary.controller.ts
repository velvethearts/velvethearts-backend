import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { DiaryService } from '../services/diary.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const saveMessageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required').optional().nullable(),
  text: z.string().max(2000).optional().nullable(),
  caption: z.string().max(500, 'Caption cannot exceed 500 characters').optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  sourceType: z.enum(['MESSAGE', 'VOICE_NOTE', 'NOTE', 'IMAGE', 'VIDEO']).optional().nullable(),
});

const addNoteSchema = z.object({
  text: z.string().min(1, 'Note cannot be empty').max(2000, 'Note cannot exceed 2000 characters'),
  caption: z.string().max(500, 'Caption cannot exceed 500 characters').optional().nullable(),
});

export class DiaryController {
  private diaryService = new DiaryService();

  /**
   * GET /api/v1/diary/:matchId
   */
  getEntries = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!matchId) {
        return res.status(400).json({ success: false, message: 'Match ID is required' });
      }

      const entries = await this.diaryService.getEntries(req.user.userId, matchId);
      return res.json({ success: true, data: entries });
    } catch (err: any) {
      logger.error('Error fetching diary entries:', err);
      const statusCode = err.message.includes('not found') || err.message.includes('not part') ? 403 : 500;
      return res.status(statusCode).json({ success: false, message: err.message || 'Failed to fetch diary entries' });
    }
  };

  /**
   * POST /api/v1/diary/:matchId/message
   */
  saveMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      const parseResult = saveMessageSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ success: false, message: parseResult.error.errors[0].message });
      }

      const entry = await this.diaryService.saveMessage(
        req.user.userId,
        matchId,
        parseResult.data.messageId || undefined,
        parseResult.data.caption || undefined,
        {
          text: parseResult.data.text || undefined,
          attachmentUrl: parseResult.data.attachmentUrl || undefined,
          sourceType: (parseResult.data.sourceType as any) || undefined,
        }
      );

      return res.status(201).json({ success: true, data: entry });
    } catch (err: any) {
      logger.error('Error saving message to diary:', err);
      const statusCode = err.message.includes('not found') || err.message.includes('not part') ? 400 : 500;
      return res.status(statusCode).json({ success: false, message: err.message || 'Failed to save message to diary' });
    }
  };

  /**
   * POST /api/v1/diary/:matchId/note
   */
  addNote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      const parseResult = addNoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ success: false, message: parseResult.error.errors[0].message });
      }

      const entry = await this.diaryService.addNote(
        req.user.userId,
        matchId,
        parseResult.data.text,
        parseResult.data.caption || undefined
      );

      return res.status(201).json({ success: true, data: entry });
    } catch (err: any) {
      logger.error('Error adding note to diary:', err);
      const statusCode = err.message.includes('not found') || err.message.includes('not part') ? 400 : 500;
      return res.status(statusCode).json({ success: false, message: err.message || 'Failed to add note to diary' });
    }
  };

  /**
   * POST /api/v1/diary/:matchId/photo
   */
  uploadPhoto = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId } = req.params;
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No photo provided' });
      }

      const caption = req.body.caption || undefined;

      const entry = await this.diaryService.uploadPhoto(
        req.user.userId,
        matchId,
        req.file.buffer,
        req.file.mimetype,
        caption
      );

      return res.status(201).json({ success: true, data: entry });
    } catch (err: any) {
      logger.error('Error uploading photo to diary:', err);

      // Handle explicit/nudity moderation rejection with non-shaming error message
      if (
        err.message?.includes('rejected') ||
        err.message?.includes('inappropriate') ||
        err.message?.includes('moderation')
      ) {
        return res.status(400).json({
          success: false,
          message: "That image couldn't be added.",
          moderationRejected: true,
        });
      }

      return res.status(500).json({ success: false, message: err.message || 'Failed to upload photo to diary' });
    }
  };

  /**
   * DELETE /api/v1/diary/:matchId/:entryId
   */
  deleteEntry = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { matchId, entryId } = req.params;
      if (!matchId || !entryId) {
        return res.status(400).json({ success: false, message: 'Match ID and Entry ID are required' });
      }

      await this.diaryService.deleteEntry(req.user.userId, matchId, entryId);
      return res.json({ success: true, message: 'Diary entry deleted' });
    } catch (err: any) {
      logger.error('Error deleting diary entry:', err);
      const statusCode = err.message.includes('only delete') ? 403 : 400;
      return res.status(statusCode).json({ success: false, message: err.message || 'Failed to delete diary entry' });
    }
  };
}
