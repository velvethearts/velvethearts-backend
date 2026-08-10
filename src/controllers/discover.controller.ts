import crypto from 'crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { DiscoverService, DiscoverFilters } from '../services/discover.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const querySchema = z.object({
  gender: z.string().optional(),
  relationshipIntent: z.string().optional(),
  city: z.string().optional(),
  ageMin: z.coerce.number().min(18).max(100).optional(),
  ageMax: z.coerce.number().min(18).max(100).optional(),
  languages: z.union([z.string(), z.array(z.string())]).transform(val => typeof val === 'string' ? [val] : val).optional(),
  education: z.string().optional(),
  occupation: z.string().optional(),
  interests: z.union([z.string(), z.array(z.string())]).transform(val => typeof val === 'string' ? [val] : val).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional().default('default'),
});

export class DiscoverController {
  private discoverService = new DiscoverService();

  getRecommendations = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid query filters', 
          errors: parsed.error.errors 
        });
      }

      const { page, limit, sortBy, ...filters } = parsed.data;

      const result = await this.discoverService.getRecommendations(
        req.user.userId,
        filters as DiscoverFilters,
        page,
        limit,
        sortBy
      );

      return res.status(200).json({
        success: true,
        data: result.profiles,
        pagination: result.pagination
      });
    } catch (error: any) {
      logger.error('getRecommendations controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving discover feed failed' });
    }
  };

  // Endpoint for Render cron to trigger discover nudges. Expects header 'x-cron-secret' to match env var CRON_SECRET.
  runDiscoverNudge = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const secret = req.headers['x-cron-secret'] as string | undefined;
      const expectedSecret = process.env.CRON_SECRET;

      if (!expectedSecret || !secret) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const secretBuffer = Buffer.from(secret);
      const expectedBuffer = Buffer.from(expectedSecret);

      if (secretBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(secretBuffer, expectedBuffer)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const inactiveHours = Number(process.env.DISCOVER_NUDGE_INACTIVE_HOURS || 12);
      const rateLimitHours = Number(process.env.DISCOVER_NUDGE_RATE_LIMIT_HOURS || 24);

      const result = await this.discoverService.sendDiscoverNudges(inactiveHours, rateLimitHours);

      return res.status(200).json({ success: true, message: 'Discover nudges processed', data: result });
    } catch (error: any) {
      logger.error('runDiscoverNudge controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to run discover nudges' });
    }
  };
}

