import { UserRepository } from '../repositories/user.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { ApprovalStatus, UserStatus, ReportStatus, Role } from '@prisma/client';
import { prisma } from '../config/database';

export class AdminService {
  private userRepository = new UserRepository();
  private logRepository = new ActivityLogRepository();

  private calculateProfileCompletion(profile: any): number {
    if (!profile) return 0;
    
    let completedFields = 0;
    const totalFields = 11;

    if (profile.name) completedFields++;
    if (profile.dob) completedFields++;
    if (profile.city) completedFields++;
    if (profile.gender) completedFields++;
    if (profile.orientation) completedFields++;
    if (profile.relationshipIntent) completedFields++;
    if (profile.relationshipStatus) completedFields++;
    if (profile.story && profile.story.length >= 20) completedFields++;
    if (profile.interests && profile.interests.length > 0) completedFields++;
    if (profile.photos && profile.photos.length > 0) completedFields++;
    if (profile.hasDisability !== undefined) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }

  async getPendingQueue() {
    const list = await this.userRepository.findPendingVerification();

    return Promise.all(list.map(async (user) => {
      const prof = user.profile;
      
      // Look up previous attempts with the same phone number or email
      const priorRecords = await prisma.user.findMany({
        where: {
          OR: [
            { phoneNumber: user.phoneNumber },
            { email: user.email ? user.email : undefined }
          ],
          id: { not: user.id }
        },
        select: {
          approvalStatus: true,
          status: true
        }
      });

      const hasPriorHistory = priorRecords.length > 0;
      const priorRejections = priorRecords.filter(r => r.approvalStatus === ApprovalStatus.REJECTED).length;
      const priorDeletions = priorRecords.filter(r => r.status === UserStatus.DELETED).length;

      return {
        userId: user.id,
        name: prof?.name || null,
        phoneNumber: user.phoneNumber,
        submissionTime: user.createdAt,
        profileCompletion: this.calculateProfileCompletion(prof),
        approvalStatus: user.approvalStatus,
        city: prof?.city || null,
        gender: prof?.gender || null,
        relationshipIntent: prof?.relationshipIntent || null,
        photos: prof?.photos.map((p: any) => p.secureUrl) || [],
        hasPriorHistory,
        priorRejections,
        priorDeletions,
      };
    }));
  }

  async approveUser(userId: string, adminId: string, notes?: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { approvalStatus: ApprovalStatus.APPROVED },
      });

      const profile = await tx.profile.findUnique({
        where: { userId },
      });
      if (profile) {
        await tx.profile.update({
          where: { userId },
          data: { verified: true },
        });
      }
    });

    await this.logRepository.create({
      userId,
      adminId,
      action: 'USER_APPROVAL',
      details: JSON.stringify({ approvedBy: adminId, notes: notes || 'No notes' }),
    });

    return { success: true };
  }

  async rejectUser(userId: string, adminId: string, notes?: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { 
          approvalStatus: ApprovalStatus.REJECTED,
          status: UserStatus.DELETED,
          deletedAt: new Date()
        },
      });

      const profile = await tx.profile.findUnique({
        where: { userId },
      });
      if (profile) {
        await tx.profile.update({
          where: { userId },
          data: { verified: false },
        });
      }
    });

    await this.logRepository.create({
      userId,
      adminId,
      action: 'USER_REJECTION',
      details: JSON.stringify({ rejectedBy: adminId, notes: notes || 'No notes' }),
    });

    return { success: true };
  }

  async getPhoneNumberHistory(queryStr: string) {
    const history = await prisma.user.findMany({
      where: {
        OR: [
          { phoneNumber: queryStr },
          { email: queryStr }
        ]
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return history.map((record) => ({
      id: record.id,
      phoneNumber: record.phoneNumber,
      email: record.email,
      role: record.role,
      approvalStatus: record.approvalStatus,
      status: record.status,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
      previousUserId: record.previousUserId,
    }));
  }

  async getDashboardStats() {
    const pendingCount = await prisma.user.count({ where: { approvalStatus: ApprovalStatus.PENDING, status: UserStatus.ACTIVE } });
    const activeCount = await prisma.user.count({ where: { status: UserStatus.ACTIVE } });
    const suspendedCount = await prisma.user.count({ where: { status: UserStatus.SUSPENDED } });
    const deletedCount = await prisma.user.count({ where: { status: UserStatus.DELETED } });
    const reportsCount = await prisma.report.count({ where: { status: ReportStatus.PENDING } });

    const recentRegistrations = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        profile: true,
      },
    });

    return {
      stats: {
        pendingCount,
        activeCount,
        suspendedCount,
        deletedCount,
        reportsCount,
        totalCount: activeCount + suspendedCount + deletedCount,
      },
      recentRegistrations: recentRegistrations.map(r => ({
        id: r.id,
        phoneNumber: r.phoneNumber,
        role: r.role,
        approvalStatus: r.approvalStatus,
        status: r.status,
        createdAt: r.createdAt,
        name: r.profile?.name || null,
      })),
    };
  }

  async getReports(status?: ReportStatus) {
    const reports = await prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { include: { profile: true } },
        reported: { include: { profile: true } },
      },
    });

    return reports.map(r => ({
      id: r.id,
      reporterId: r.reporterId,
      reporterName: r.reporter.profile?.name || 'Velvet Hearts Member',
      reportedId: r.reportedId,
      reportedName: r.reported.profile?.name || 'Velvet Hearts Member',
      reason: r.reason,
      comment: r.comment,
      status: r.status,
      internalNotes: r.internalNotes,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      closedAt: r.closedAt,
    }));
  }

  async closeReport(reportId: string, adminId: string, status: 'RESOLVED' | 'IGNORED', internalNotes?: string) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('Report not found');
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: status as ReportStatus,
        resolvedAt: new Date(),
        closedAt: new Date(),
        internalNotes: internalNotes || report.internalNotes,
      },
    });

    await this.logRepository.create({
      adminId,
      action: 'CLOSE_REPORT',
      details: JSON.stringify({ reportId, status, internalNotes }),
    });

    return updated;
  }

  async getUsers(searchQuery?: string, role?: Role, status?: UserStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (role) {
      whereClause.role = role;
    }

    if (status) {
      whereClause.status = status;
    }

    if (searchQuery) {
      whereClause.OR = [
        { phoneNumber: { contains: searchQuery, mode: 'insensitive' } },
        {
          profile: {
            name: { contains: searchQuery, mode: 'insensitive' },
          },
        },
      ];
    }

    const total = await prisma.user.count({ where: whereClause });
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    return {
      users: users.map(u => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        role: u.role,
        approvalStatus: u.approvalStatus,
        status: u.status,
        createdAt: u.createdAt,
        name: u.profile?.name || null,
        city: u.profile?.city || null,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Super Admin: promote, demote, suspend, restore
  async createAdmin(userId: string, superAdminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });

    await this.logRepository.create({
      adminId: superAdminId,
      action: 'CREATE_ADMIN',
      details: JSON.stringify({ promotedUserId: userId }),
    });

    return { success: true };
  }

  async removeAdmin(userId: string, superAdminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: Role.USER },
    });

    await this.logRepository.create({
      adminId: superAdminId,
      action: 'REMOVE_ADMIN',
      details: JSON.stringify({ demotedUserId: userId }),
    });

    return { success: true };
  }

  async suspendUser(userId: string, adminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await this.logRepository.create({
      adminId,
      action: 'SUSPEND_USER',
      details: JSON.stringify({ suspendedUserId: userId }),
    });

    return { success: true };
  }

  async restoreUser(userId: string, adminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    await this.logRepository.create({
      adminId,
      action: 'RESTORE_USER',
      details: JSON.stringify({ restoredUserId: userId }),
    });

    return { success: true };
  }

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const total = await prisma.activityLog.count();
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      include: {
        user: { include: { profile: true } },
        admin: { include: { profile: true } },
      },
    });

    return {
      logs: logs.map(l => ({
        id: l.id,
        userId: l.userId,
        userName: l.user?.profile?.name || null,
        adminId: l.adminId,
        adminName: l.admin?.profile?.name || null,
        action: l.action,
        details: l.details,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
