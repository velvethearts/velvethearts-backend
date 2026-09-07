import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AdminService } from '../services/admin.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { ReportStatus, UserStatus, Role, VerificationRequestStatus, ApprovalStatus } from '@prisma/client';

const approveRejectSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

const closeReportSchema = z.object({
  status: z.enum(['RESOLVED', 'IGNORED']),
  internalNotes: z.string().optional(),
});

const emptyToUndefined = (val: unknown) => {
  if (val === '' || val === 'undefined' || val === 'null' || val === undefined) return undefined;
  return val;
};

const getUsersSchema = z.object({
  searchQuery: z.preprocess(emptyToUndefined, z.string().optional()),
  role: z.preprocess(emptyToUndefined, z.nativeEnum(Role).optional()),
  status: z.preprocess(emptyToUndefined, z.nativeEnum(UserStatus).optional()),
  approvalStatus: z.preprocess(emptyToUndefined, z.nativeEnum(ApprovalStatus).optional()),
  profileStatus: z.preprocess(emptyToUndefined, z.enum(['COMPLETED', 'INCOMPLETE']).optional()),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// [H-8 FIX] Zod schema for audit log pagination with enforced max limit
const auditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
});

// [H-9 FIX] Zod schema for report status filter
const reportStatusSchema = z.object({
  status: z.nativeEnum(ReportStatus).optional(),
});

// Zod schema for verification request status filter
const verificationStatusSchema = z.object({
  status: z.nativeEnum(VerificationRequestStatus).optional(),
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
      // [H-9 FIX] Validate status parameter with Zod enum
      const parsed = reportStatusSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid report status filter' });
      }
      const reports = await this.adminService.getReports(parsed.data.status);
      return res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error: any) {
      logger.error('getReports controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving reports failed' });
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

      const { searchQuery, role, status, approvalStatus, profileStatus, page, limit } = result.data;
      const data = await this.adminService.getUsers(searchQuery, role, status, approvalStatus, page, limit, profileStatus);

      return res.status(200).json({
        success: true,
        data: {
          users: data.users,
          pagination: data.pagination,
        },
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

  deleteUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { userId } = req.params;
      await this.adminService.deleteUser(userId, req.user.userId);

      return res.status(200).json({
        success: true,
        message: 'User account marked as deleted',
      });
    } catch (error: any) {
      logger.error('deleteUser controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Deleting user failed' });
    }
  };

  getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // [H-8 FIX] Validate and cap pagination parameters
      const parsed = auditLogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid pagination parameters' });
      }

      const data = await this.adminService.getAuditLogs(parsed.data.page, parsed.data.limit);

      return res.status(200).json({
        success: true,
        data: data.logs,
        pagination: data.pagination,
      });
    } catch (error: any) {
      logger.error('getAuditLogs controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving audit logs failed' });
    }
  };

  // ============================================
  // VERIFICATION REQUEST REVIEW
  // ============================================

  getVerificationRequests = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = verificationStatusSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid verification status filter' });
      }
      const requests = await this.adminService.getVerificationRequests(parsed.data.status);
      return res.status(200).json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      logger.error('getVerificationRequests controller failure:', error);
      return res.status(500).json({ success: false, message: 'Retrieving verification requests failed' });
    }
  };

  approveVerification = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;
      const { notes } = req.body;

      await this.adminService.approveVerification(id, req.user.userId, notes);

      return res.status(200).json({
        success: true,
        message: 'Verification request approved successfully',
      });
    } catch (error: any) {
      logger.error('approveVerification controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Approving verification failed' });
    }
  };

  rejectVerification = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;
      const { notes } = req.body;

      await this.adminService.rejectVerification(id, req.user.userId, notes);

      return res.status(200).json({
        success: true,
        message: 'Verification request rejected',
      });
    } catch (error: any) {
      logger.error('rejectVerification controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Rejecting verification failed' });
    }
  };

  toggleUserVerification = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { userId } = req.params;
      const { verified } = req.body;

      await this.adminService.toggleUserVerification(userId, req.user.userId, Boolean(verified));

      return res.status(200).json({
        success: true,
        message: `User verification updated to ${Boolean(verified)}`,
      });
    } catch (error: any) {
      logger.error('toggleUserVerification controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Updating user verification failed' });
    }
  };

  createDemoVerification = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const request = await this.adminService.createDemoVerification(req.user.userId);

      return res.status(201).json({
        success: true,
        data: request,
        message: 'Demo verification request generated successfully',
      });
    } catch (error: any) {
      logger.error('createDemoVerification controller failure:', error);
      return res.status(500).json({ success: false, message: error.message || 'Creating demo verification failed' });
    }
  };
}
