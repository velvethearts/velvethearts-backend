import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ProfileService } from '../services/profile.service';
import { saveProfileSchema } from '../validators/profile.validator';
import { logger } from '../utils/logger';
import { z } from 'zod';

// [H-2 FIX] Explicit Zod schema for settings updates — prevents mass assignment
const updateSettingsSchema = z.object({
  matchNotifs: z.boolean().optional(),
  chatNotifs: z.boolean().optional(),
  interestNotifs: z.boolean().optional(),
  emailNotifs: z.boolean().optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  reduceMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  textSize: z.enum(['small', 'medium', 'large']).optional(),
}).strict();

export class ProfileController {
  private profileService = new ProfileService();

  getMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const profile = await this.profileService.getProfile(req.user.userId);

      // Always return user-level fields so the frontend can check approval status
      const userData = {
        approvalStatus: req.user.approvalStatus,
        role: req.user.role,
      };

      if (!profile) {
        return res.status(200).json({
          success: true,
          message: 'Profile not found. Onboarding required.',
          data: null,
          user: userData,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...profile,
          approvalStatus: req.user.approvalStatus,
          role: req.user.role,
        },
        user: userData,
      });
    } catch (error: any) {
      logger.error('getMe controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving profile failed' });
    }
  };

  saveProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = saveProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const profile = await this.profileService.saveProfile(req.user.userId, result.data);

      return res.status(200).json({
        success: true,
        message: 'Profile saved successfully',
        data: profile,
      });
    } catch (error: any) {
      logger.error('saveProfile controller failure:', error);
      return res.status(500).json({ success: false, message: 'Saving profile failed' });
    }
  };

  deleteAccount = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const ip = req.ip;
      const ua = req.headers['user-agent'];

      await this.profileService.softDeleteAccount(req.user.userId, ip, ua, req.body);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error: any) {
      logger.error('deleteAccount controller failure:', error);
      return res.status(500).json({ success: false, message: 'Deleting account failed' });
    }
  };

  getSettings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const settings = await this.profileService.getSettings(req.user.userId);
      return res.status(200).json({ success: true, data: settings });
    } catch (error: any) {
      logger.error('getSettings controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving settings failed' });
    }
  };

  updateSettings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // [H-2 FIX] Validate with strict schema to prevent mass assignment
      const result = updateSettingsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const settings = await this.profileService.updateSettings(req.user.userId, result.data);
      return res.status(200).json({ success: true, message: 'Settings updated successfully', data: settings });
    } catch (error: any) {
      logger.error('updateSettings controller failure:', error);
      return res.status(500).json({ success: false, message: 'Updating settings failed' });
    }
  };
}
