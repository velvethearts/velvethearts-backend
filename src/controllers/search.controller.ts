import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SearchService, SearchFilters } from '../services/search.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const searchQuerySchema = z.object({
  name: z.string().optional(),
  city: z.string().optional(),
  interest: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  gender: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export class SearchController {
  private searchService = new SearchService();

  search = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const parsed = searchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid search parameters', 
          errors: parsed.error.errors 
        });
      }

      const { page, limit, ...filters } = parsed.data;

      const result = await this.searchService.searchProfiles(
        req.user.userId,
        filters as SearchFilters,
        page,
        limit
      );

      return res.status(200).json({
        success: true,
        data: result.profiles,
        pagination: result.pagination
      });
    } catch (error: any) {
      logger.error('Search controller failure:', error);
      return res.status(500).json({ success: false, message: 'Profile search failed' });
    }
  };
}
