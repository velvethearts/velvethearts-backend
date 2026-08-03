import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UploadService } from '../services/upload.service';
import { logger } from '../utils/logger';

export class UploadController {
  private uploadService = new UploadService();

  uploadPhoto = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : null);
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const result = await this.uploadService.uploadImage(file.buffer);

      return res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          ...result,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      });
    } catch (error: any) {
      logger.error('Upload controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Photo upload failed' });
    }
  };
}
