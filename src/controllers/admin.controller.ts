import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AdminService } from '../services/admin.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { ReportStatus, UserStatus, Role } from '@prisma/client';

const approveRejectSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

const closeReportSchema = z.object({
  status: z.enum(['RESOLVED', 'IGNORED']),
  internalNotes: z.string().optional(),
});

const getUsersSchema = z.object({
  searchQuery: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export class AdminController {
  private adminService = new AdminService();

  getPendingQueue = async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const queue = await this.adminService.getPendingQueue();
      return res.status(200).json({
        success: true,
        data: queue,
      });
    } catch (error: any) {
      logger.error('getPendingQueue controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving pending queue failed' });
    }
  };

  approve = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = approveRejectSchema.safeParse(req.params);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const { notes } = req.body;

      await this.adminService.approveUser(result.data.userId, req.user.userId, notes);

      return res.status(200).json({
        success: true,
        message: 'User approved successfully',
      });
    } catch (error: any) {
      logger.error('Approve controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Approving user failed' });
    }
  };

  reject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = approveRejectSchema.safeParse(req.params);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const { notes } = req.body;

      await this.adminService.rejectUser(result.data.userId, req.user.userId, notes);

      return res.status(200).json({
        success: true,
        message: 'User rejected successfully',
      });
    } catch (error: any) {
      logger.error('Reject controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Rejecting user failed' });
    }
  };

  getPhoneHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { phoneNumber } = req.query;
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ success: false, message: 'Phone number parameter is required' });
      }

      const history = await this.adminService.getPhoneNumberHistory(phoneNumber);

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('getPhoneHistory controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving phone history failed' });
    }
  };

  getDashboardStats = async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await this.adminService.getDashboardStats();
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('getDashboardStats controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving stats failed' });
    }
  };

  getReports = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status } = req.query;
      const reportStatus = status ? (status as ReportStatus) : undefined;
      const reports = await this.adminService.getReports(reportStatus);
      return res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error: any) {
      logger.error('getReports controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving reports failed' });
    }
  };

  closeReport = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { reportId } = req.params;
      const result = closeReportSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const report = await this.adminService.closeReport(
        reportId,
        req.user.userId,
        result.data.status,
        result.data.internalNotes
      );

      return res.status(200).json({
        success: true,
        message: 'Report resolved successfully',
        data: report,
      });
    } catch (error: any) {
      logger.error('closeReport controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Resolving report failed' });
    }
  };

  getUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = getUsersSchema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error.errors[0].message });
      }

      const { searchQuery, role, status, page, limit } = result.data;
      const data = await this.adminService.getUsers(searchQuery, role, status, page, limit);

      return res.status(200).json({
        success: true,
        data: data.users,
        pagination: data.pagination,
      });
    } catch (error: any) {
      logger.error('getUsers controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Querying users failed' });
    }
  };

  createAdmin = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
      }

      await this.adminService.createAdmin(userId, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Admin role granted successfully',
      });
    } catch (error: any) {
      logger.error('createAdmin controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Creating admin failed' });
    }
  };

  removeAdmin = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
      }

      await this.adminService.removeAdmin(userId, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Admin role removed successfully',
      });
    } catch (error: any) {
      logger.error('removeAdmin controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Removing admin failed' });
    }
  };

  suspendUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { userId } = req.params;
      await this.adminService.suspendUser(userId, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Account suspended successfully',
      });
    } catch (error: any) {
      logger.error('suspendUser controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Suspending user failed' });
    }
  };

  restoreUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { userId } = req.params;
      await this.adminService.restoreUser(userId, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'Account restored successfully',
      });
    } catch (error: any) {
      logger.error('restoreUser controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Restoring user failed' });
    }
  };

  getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, limit } = req.query;
      const pageNum = page ? parseInt(String(page), 10) : 1;
      const limitNum = limit ? parseInt(String(limit), 10) : 50;

      const data = await this.adminService.getAuditLogs(pageNum, limitNum);

      return res.status(200).json({
        success: true,
        data: data.logs,
        pagination: data.pagination,
      });
    } catch (error: any) {
      logger.error('getAuditLogs controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Retrieving audit logs failed' });
    }
  };
}
