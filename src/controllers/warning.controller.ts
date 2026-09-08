import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { WarningService } from '../services/warning.service';
import { logger } from '../utils/logger';

export class WarningController {
  private warningService = new WarningService();

  getActiveWarning = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const warning = await this.warningService.getActiveWarningForUser(req.user.userId);

      return res.status(200).json({
        success: true,
        data: warning,
      });
    } catch (error: any) {
      logger.error('getActiveWarning controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving warning failed' });
    }
  };

  submitAppeal = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { warningId } = req.params;
      const { appealText, appealPhotos } = req.body;

      if (!appealText || !appealText.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide an explanation for your appeal' });
      }

      const updatedWarning = await this.warningService.submitAppeal(
        warningId,
        req.user.userId,
        appealText.trim(),
        Array.isArray(appealPhotos) ? appealPhotos : []
      );

      return res.status(200).json({
        success: true,
        data: updatedWarning,
        message: 'Your appeal has been submitted. The auto-suspension countdown has been paused while an admin reviews your explanation and proof.',
      });
    } catch (error: any) {
      logger.error('submitAppeal controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Submitting appeal failed' });
    }
  };
}
