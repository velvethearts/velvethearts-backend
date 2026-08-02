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
}
