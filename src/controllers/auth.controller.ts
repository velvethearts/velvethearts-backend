import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { firebaseLoginSchema } from '../validators/auth.validator';
import { logger } from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';

export class AuthController {
  private authService = new AuthService();

  login = async (req: Request, res: Response) => {
    try {
      const result = firebaseLoginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const user = await this.authService.authenticateFirebaseUser(result.data.firebaseIdToken, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { user },
      });
    } catch (error: any) {
      logger.error('Firebase login controller failure:', error);
      
      const safeMessage = sanitizeErrorMessage(
        error,
        'Authentication failed. Please try again after a while.'
      );

      return res.status(500).json({
        success: false,
        message: safeMessage,
      });
    }
  };
}
