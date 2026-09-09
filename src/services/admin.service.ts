import { UserRepository } from '../repositories/user.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { ApprovalStatus, UserStatus, ReportStatus, Role, VerificationRequestStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

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
      
      // Look up previous attempts with the same phone number or email safely
      const priorConditions: any[] = [];
      if (user.phoneNumber) priorConditions.push({ phoneNumber: user.phoneNumber });
      if (user.email) priorConditions.push({ email: user.email });

      const priorRecords = priorConditions.length > 0 ? await prisma.user.findMany({
        where: {
          OR: priorConditions,
          id: { not: user.id }
        },
        select: {
          approvalStatus: true,
          status: true
        }
      }) : [];

      const hasPriorHistory = priorRecords.length > 0;
      const priorRejections = priorRecords.filter(r => r.approvalStatus === ApprovalStatus.REJECTED).length;
      const priorDeletions = priorRecords.filter(r => r.status === UserStatus.DELETED).length;

      const photoUrls = prof?.photos?.map((p: any) => p?.secureUrl || p) || [];
      const isVerified = Boolean(prof?.verified);

      return {
        id: user.id,
        userId: user.id,
        name: prof?.name || user.name || null,
        phoneNumber: user.phoneNumber,
        email: user.email || null,
        submissionTime: user.createdAt,
        createdAt: user.createdAt,
        role: user.role,
        status: user.status,
        verified: isVerified,
        hasProfile: Boolean(prof),
        profileCompletion: this.calculateProfileCompletion(prof),
        approvalStatus: user.approvalStatus,
        city: prof?.city || null,
        gender: prof?.gender || null,
        relationshipIntent: prof?.relationshipIntent || null,
        photos: photoUrls,
        hasPriorHistory,
        priorRejections,
        priorDeletions,
        profile: prof ? {
          ...prof,
          id: prof.id,
          userId: user.id,
          name: prof.name || user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          status: user.status,
          verified: isVerified,
          photos: photoUrls,
          promptAnswers: (prof as any).promptAnswers || [],
        } : null,
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
    const verificationPendingCount = await prisma.verificationRequest.count({ where: { status: VerificationRequestStatus.PENDING } });
    const userCount = await prisma.user.count({ where: { role: Role.USER } });
    const adminCount = await prisma.user.count({ where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } } });
    const approvedCount = await prisma.user.count({ where: { approvalStatus: ApprovalStatus.APPROVED } });
    const rejectedCount = await prisma.user.count({ where: { approvalStatus: ApprovalStatus.REJECTED } });
    const verifiedCount = await prisma.profile.count({ where: { verified: true } });
    const completedProfileCount = await prisma.user.count({ where: { profile: { isNot: null } } });
    const incompleteProfileCount = await prisma.user.count({ where: { profile: null } });

    const recentRegistrations = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        profile: {
          include: {
            photos: {
              orderBy: { photoOrder: 'asc' },
            },
            promptAnswers: true,
          },
        },
      },
    });

    return {
      stats: {
        pendingCount,
        activeCount,
        suspendedCount,
        deletedCount,
        reportsCount,
        verificationPendingCount,
        verifiedCount,
        totalCount: activeCount + suspendedCount + deletedCount,
        userCount,
        adminCount,
        approvedCount,
        rejectedCount,
        completedProfileCount,
        incompleteProfileCount,
      },
      recentRegistrations: recentRegistrations.map(r => {
        const photoUrls = r.profile?.photos?.map((p: any) => p?.secureUrl || p) || [];
        const isVerified = r.profile?.verified || false;
        return {
          id: r.id,
          email: r.email,
          phoneNumber: r.phoneNumber,
          role: r.role,
          approvalStatus: r.approvalStatus,
          status: r.status,
          createdAt: r.createdAt,
          name: r.profile?.name || r.name || null,
          hasProfile: Boolean(r.profile),
          city: r.profile?.city || null,
          verified: isVerified,
          avatarUrl: photoUrls[0] || null,
          photos: photoUrls,
          profile: r.profile ? {
            ...r.profile,
            id: r.profile.id,
            userId: r.id,
            name: r.profile.name || r.name,
            email: r.email,
            phoneNumber: r.phoneNumber,
            role: r.role,
            status: r.status,
            verified: isVerified,
            photos: photoUrls,
            promptAnswers: r.profile.promptAnswers || [],
          } : null,
        };
      }),
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

  async getUsers(
    searchQuery?: string,
    role?: Role,
    status?: UserStatus,
    approvalStatus?: ApprovalStatus,
    page = 1,
    limit = 20,
    profileStatus?: 'COMPLETED' | 'INCOMPLETE'
  ) {
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (role) {
      whereClause.role = role;
    }

    if (status) {
      whereClause.status = status;
    }

    if (approvalStatus) {
      whereClause.approvalStatus = approvalStatus;
    }

    if (profileStatus === 'COMPLETED') {
      whereClause.profile = { isNot: null };
    } else if (profileStatus === 'INCOMPLETE') {
      whereClause.profile = null;
    }

    if (searchQuery) {
      whereClause.OR = [
        { id: { contains: searchQuery, mode: 'insensitive' } },
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { phoneNumber: { contains: searchQuery, mode: 'insensitive' } },
        { email: { contains: searchQuery, mode: 'insensitive' } },
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
        profile: {
          include: {
            photos: {
              orderBy: { photoOrder: 'asc' },
            },
            promptAnswers: true,
          },
        },
        verificationRequests: {
          where: { status: 'APPROVED' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    return {
      users: users.map(u => {
        const photoUrls = u.profile?.photos?.map((p: any) => p?.secureUrl || p) || [];
        const isVerified = u.profile ? Boolean(u.profile.verified) : Boolean(u.verificationRequests && u.verificationRequests.length > 0);
        return {
          id: u.id,
          email: u.email,
          phoneNumber: u.phoneNumber,
          role: u.role,
          approvalStatus: u.approvalStatus,
          status: u.status,
          createdAt: u.createdAt,
          name: u.profile?.name || u.name || null,
          hasProfile: Boolean(u.profile),
          city: u.profile?.city || null,
          verified: isVerified,
          photos: photoUrls,
          profile: u.profile ? {
            ...u.profile,
            id: u.profile.id,
            userId: u.id,
            name: u.profile.name || u.name,
            email: u.email,
            phoneNumber: u.phoneNumber,
            role: u.role,
            status: u.status,
            verified: isVerified,
            photos: photoUrls,
            promptAnswers: u.profile.promptAnswers || [],
          } : null,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUserById(userId: string) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            photos: {
              orderBy: { photoOrder: 'asc' },
            },
            promptAnswers: true,
          },
        },
        verificationRequests: {
          where: { status: 'APPROVED' },
          take: 1,
        },
      },
    });

    if (!u) return null;

    const photoUrls = u.profile?.photos?.map((p: any) => p?.secureUrl || p) || [];
    const isVerified = u.profile ? Boolean(u.profile.verified) : Boolean(u.verificationRequests && u.verificationRequests.length > 0);

    return {
      id: u.id,
      email: u.email,
      phoneNumber: u.phoneNumber,
      role: u.role,
      approvalStatus: u.approvalStatus,
      status: u.status,
      createdAt: u.createdAt,
      name: u.profile?.name || u.name || null,
      hasProfile: Boolean(u.profile),
      city: u.profile?.city || null,
      verified: isVerified,
      photos: photoUrls,
      profile: u.profile ? {
        ...u.profile,
        id: u.profile.id,
        userId: u.id,
        name: u.profile.name || u.name,
        email: u.email,
        phoneNumber: u.phoneNumber,
        role: u.role,
        status: u.status,
        verified: isVerified,
        photos: photoUrls,
        promptAnswers: u.profile.promptAnswers || [],
      } : null,
    };
  }

  async toggleUserVerification(userId: string, adminId: string, verified: boolean) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let profile = user.profile;

    if (profile) {
      profile = await prisma.profile.update({
        where: { userId },
        data: { verified },
      });
    }

    if (verified) {
      const existingReq = await prisma.verificationRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (existingReq) {
        await prisma.verificationRequest.updateMany({
          where: { userId },
          data: {
            status: VerificationRequestStatus.APPROVED,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            adminNotes: 'Verified directly by admin in Admin Panel',
          },
        });
      } else {
        await prisma.verificationRequest.create({
          data: {
            userId,
            selfieUrl: '',
            status: VerificationRequestStatus.APPROVED,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            adminNotes: 'Verified directly by admin in Admin Panel',
          },
        });
      }
    } else {
      // Mark all verification requests as REJECTED so no old approved request lingers
      await prisma.verificationRequest.updateMany({
        where: { userId },
        data: {
          status: VerificationRequestStatus.REJECTED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          adminNotes: 'Unverified by admin',
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        adminId,
        userId,
        action: verified ? 'VERIFY_USER_MANUAL' : 'UNVERIFY_USER_MANUAL',
        details: JSON.stringify({ verified, hadProfile: Boolean(profile) }),
      },
    });

    // Notify the user in real time via Socket.IO
    try {
      const { io } = await import('../socket');
      if (io) {
        io.to(userId).emit('user_verification_updated', {
          userId,
          verified,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.warn('Failed to emit user_verification_updated socket event:', err);
    }

    return {
      success: true,
      verified,
      hadProfile: Boolean(profile),
      profile,
    };
  }

  async createDemoVerification(_adminId: string) {
    const user = await prisma.user.findFirst({
      where: {
        profile: {
          photos: { some: {} },
        },
      },
      include: {
        profile: {
          include: {
            photos: { take: 1 },
          },
        },
      },
    });

    if (!user || !user.profile) {
      throw new Error('No user profile found to generate demo verification');
    }

    const demoReq = await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        selfieUrl: user.profile.photos[0]?.secureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
        referenceUrl: user.profile.photos[0]?.secureUrl || null,
        autoFailReason: 'Demo: Minor facial angle variance (33 deg roll angle detected)',
        status: VerificationRequestStatus.PENDING,
      },
    });

    return demoReq;
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      throw new Error('Admin accounts cannot be suspended');
    }

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

  async deleteUser(userId: string, adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      throw new Error('Admin accounts cannot be deleted');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
        firebaseUid: null,
      },
    });

    await this.logRepository.create({
      userId,
      adminId,
      action: 'ADMIN_DELETE_USER',
      details: JSON.stringify({ deletedBy: adminId }),
    });

    return { success: true };
  }

  async restoreUser(userId: string, adminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
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

  // ============================================
  // VERIFICATION REQUEST REVIEW (Admin Panel)
  // ============================================

  async getVerificationRequests(status?: VerificationRequestStatus) {
    const requests = await prisma.verificationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: {
            profile: {
              include: { photos: true, promptAnswers: true },
            },
          },
        },
        reviewer: {
          include: { profile: true },
        },
      },
    });

    return requests.map(r => {
      const photoUrls = r.user?.profile?.photos?.map((p: any) => p?.secureUrl || p) || [];
      const isVerified = r.user?.profile ? Boolean(r.user.profile.verified) : (r.status === 'APPROVED');
      return {
        id: r.id,
        userId: r.userId,
        userName: r.user?.profile?.name || r.user?.name || 'Unknown',
        userPhone: r.user?.phoneNumber || '—',
        userCity: r.user?.profile?.city || null,
        userGender: r.user?.profile?.gender || null,
        selfieUrl: r.selfieUrl,
        referenceUrl: r.referenceUrl,
        profilePhotos: photoUrls,
        autoFailReason: r.autoFailReason,
        adminNotes: r.adminNotes,
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewerName: r.reviewer?.profile?.name || null,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        user: r.user ? {
          id: r.user.id,
          name: r.user.profile?.name || r.user.name,
          email: r.user.email,
          phoneNumber: r.user.phoneNumber,
          role: r.user.role,
          status: r.user.status,
          verified: isVerified,
          avatarUrl: photoUrls[0] || null,
          photos: photoUrls,
          hasProfile: Boolean(r.user.profile),
          profile: r.user.profile ? {
            ...r.user.profile,
            id: r.user.profile.id,
            userId: r.user.id,
            name: r.user.profile.name || r.user.name,
            email: r.user.email,
            phoneNumber: r.user.phoneNumber,
            role: r.user.role,
            status: r.user.status,
            verified: isVerified,
            photos: photoUrls,
            promptAnswers: r.user.profile.promptAnswers || [],
          } : null,
        } : null,
      };
    });
  }

  async approveVerification(requestId: string, adminId: string, notes?: string) {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Verification request not found');
    if (request.status !== 'PENDING') throw new Error('Request already reviewed');

    await prisma.$transaction(async (tx) => {
      // Update the verification request
      await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: VerificationRequestStatus.APPROVED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          adminNotes: notes || null,
        },
      });

      // Set the user's profile as verified
      const profile = await tx.profile.findUnique({
        where: { userId: request.userId },
      });
      if (profile) {
        await tx.profile.update({
          where: { userId: request.userId },
          data: { verified: true },
        });
      }
    });

    await this.logRepository.create({
      userId: request.userId,
      adminId,
      action: 'VERIFICATION_APPROVED',
      details: JSON.stringify({ requestId, notes: notes || 'No notes' }),
    });

    return { success: true };
  }

  async rejectVerification(requestId: string, adminId: string, notes?: string) {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Verification request not found');
    if (request.status !== 'PENDING') throw new Error('Request already reviewed');

    await prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: VerificationRequestStatus.REJECTED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          adminNotes: notes || null,
        },
      });

      await tx.profile.updateMany({
        where: { userId: request.userId },
        data: { verified: false },
      });
    });

    await this.logRepository.create({
      userId: request.userId,
      adminId,
      action: 'VERIFICATION_REJECTED',
      details: JSON.stringify({ requestId, notes: notes || 'No notes' }),
    });

    return { success: true };
  }

  // ============================================
  // ADMIN WARNING SYSTEM
  // ============================================

  async issueWarning(
    userId: string,
    adminId: string,
    data: { violationType: string; message: string; deadlineHours?: number; autoSuspend?: boolean }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            photos: { orderBy: { photoOrder: 'asc' } },
          },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const photoUrls = user.profile?.photos?.map((p: any) => p?.secureUrl || p) || [];
    const snapshot = {
      name: user.profile?.name || user.name || '',
      photos: photoUrls,
      verified: Boolean(user.profile?.verified),
    };

    const deadlineHours = data.deadlineHours || 24;
    const expiresAt = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);
    const autoSuspend = data.autoSuspend !== undefined ? Boolean(data.autoSuspend) : true;

    const warning = await prisma.adminWarning.create({
      data: {
        userId,
        adminId,
        violationType: data.violationType || 'POLICY',
        message: data.message,
        snapshotValue: JSON.stringify(snapshot),
        deadlineHours,
        expiresAt,
        autoSuspend,
        status: 'ACTIVE',
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        adminId,
        action: 'ADMIN_ISSUE_WARNING',
        details: JSON.stringify({
          warningId: warning.id,
          violationType: data.violationType,
          deadlineHours,
          autoSuspend,
          message: data.message,
        }),
      },
    });

    // Create in-app notification
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: 'ADMIN_NOTICE',
          title: '⚠️ Profile Compliance Notice',
          content: data.message,
          relatedId: warning.id,
        },
      });
    } catch (notifErr) {
      logger.warn('Failed to create warning notification:', notifErr);
    }

    // Real-time socket event
    try {
      const { io } = await import('../socket');
      if (io) {
        io.to(userId).emit('warning_issued', {
          warningId: warning.id,
          violationType: warning.violationType,
          message: warning.message,
          deadlineHours,
          expiresAt,
          autoSuspend,
        });

        // Broadcast to admin control centers so warnings tab updates in real-time
        io.emit('admin_warning_updated', {
          warningId: warning.id,
          userId,
          status: 'ACTIVE',
        });
      }
    } catch (err) {
      logger.warn('Failed to emit warning_issued socket event:', err);
    }

    return warning;
  }

  async getWarnings(statusFilter?: string) {
    // 1. Check open warnings for compliance updates or auto-suspension
    const openWarnings = await prisma.adminWarning.findMany({
      where: {
        status: { in: ['ACTIVE', 'APPEALED'] },
      },
      include: {
        user: {
          include: {
            profile: {
              include: { photos: { orderBy: { photoOrder: 'asc' } } },
            },
          },
        },
      },
    });

    for (const warning of openWarnings) {
      let snapshot: any = null;
      try {
        snapshot = JSON.parse(warning.snapshotValue || '{}');
      } catch {}

      const currentName = warning.user?.profile?.name || warning.user?.name || '';
      const currentPhotos = warning.user?.profile?.photos?.map((p: any) => p.secureUrl || p) || [];

      let nameChanged = false;
      let photosChanged = false;

      if (snapshot?.name && currentName && snapshot.name !== currentName) {
        nameChanged = true;
      }
      if (snapshot?.photos && Array.isArray(snapshot.photos)) {
        const snapSet = new Set(snapshot.photos);
        if (currentPhotos.length !== snapshot.photos.length || currentPhotos.some(url => !snapSet.has(url))) {
          photosChanged = true;
        }
      }

      // Auto-resolve if user complied
      if (warning.status === 'ACTIVE' && warning.violationType === 'NAME' && nameChanged) {
        await prisma.adminWarning.update({
          where: { id: warning.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolutionNote: `User updated name from "${snapshot.name}" to "${currentName}". Auto-resolved.`,
          },
        });
        continue;
      }

      if (warning.status === 'ACTIVE' && warning.violationType === 'PHOTO' && photosChanged) {
        await prisma.adminWarning.update({
          where: { id: warning.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolutionNote: 'User updated profile photos. Auto-resolved.',
          },
        });
        continue;
      }

      // Auto-suspend expired warnings if user hasn't appealed (status === 'ACTIVE' only)
      if (
        warning.status === 'ACTIVE' &&
        warning.autoSuspend &&
        new Date() > warning.expiresAt
      ) {
        await prisma.user.update({
          where: { id: warning.userId },
          data: { status: UserStatus.SUSPENDED },
        });

        await prisma.adminWarning.update({
          where: { id: warning.id },
          data: {
            status: 'SUSPENDED',
            resolvedAt: new Date(),
            resolutionNote: 'Deadline passed without compliance. Auto-suspended by system.',
          },
        });

        await prisma.activityLog.create({
          data: {
            userId: warning.userId,
            action: 'AUTO_SUSPEND_EXPIRED_WARNING',
            details: JSON.stringify({ warningId: warning.id, deadlineHours: warning.deadlineHours }),
          },
        });
      }
    }

    // 2. Fetch all warnings with enriched data
    const warnings = await prisma.adminWarning.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: {
            profile: {
              include: { photos: { orderBy: { photoOrder: 'asc' } } },
            },
          },
        },
        admin: {
          include: { profile: true },
        },
      },
    });

    return warnings.map(w => {
      let snapshot: any = null;
      try {
        snapshot = JSON.parse(w.snapshotValue || '{}');
      } catch {}

      const currentName = w.user?.profile?.name || w.user?.name || '';
      const currentPhotos = w.user?.profile?.photos?.map((p: any) => p.secureUrl || p) || [];

      let nameChanged = false;
      let photosChanged = false;

      if (snapshot?.name && currentName && snapshot.name !== currentName) {
        nameChanged = true;
      }
      if (snapshot?.photos && Array.isArray(snapshot.photos)) {
        const snapSet = new Set(snapshot.photos);
        if (currentPhotos.length !== snapshot.photos.length || currentPhotos.some(url => !snapSet.has(url))) {
          photosChanged = true;
        }
      }

      const isExpired = new Date() > w.expiresAt;
      const remainingMs = Math.max(0, w.expiresAt.getTime() - Date.now());

      return {
        id: w.id,
        userId: w.userId,
        userName: currentName || 'Member',
        userEmail: w.user?.email || null,
        userPhone: w.user?.phoneNumber || null,
        userStatus: w.user?.status,
        adminId: w.adminId,
        adminName: w.admin?.profile?.name || w.admin?.name || 'Admin',
        violationType: w.violationType,
        message: w.message,
        deadlineHours: w.deadlineHours,
        expiresAt: w.expiresAt,
        remainingMs,
        isExpired,
        autoSuspend: w.autoSuspend,
        status: w.status,
        appealText: w.appealText,
        appealPhotos: w.appealPhotos,
        appealedAt: w.appealedAt,
        resolvedAt: w.resolvedAt,
        resolvedBy: w.resolvedBy,
        resolutionNote: w.resolutionNote,
        createdAt: w.createdAt,
        snapshot,
        currentName,
        currentPhotos,
        nameChanged,
        photosChanged,
        user: w.user ? {
          id: w.user.id,
          name: currentName,
          email: w.user.email,
          phoneNumber: w.user.phoneNumber,
          role: w.user.role,
          status: w.user.status,
          approvalStatus: w.user.approvalStatus,
          createdAt: w.user.createdAt,
          verified: Boolean(w.user.profile?.verified),
          avatarUrl: currentPhotos[0] || null,
          photos: currentPhotos,
          hasProfile: Boolean(w.user.profile),
          profile: w.user.profile ? {
            ...w.user.profile,
            id: w.user.profile.id,
            userId: w.user.id,
            name: currentName,
            email: w.user.email,
            phoneNumber: w.user.phoneNumber,
            role: w.user.role,
            status: w.user.status,
            verified: Boolean(w.user.profile.verified),
            photos: currentPhotos,
            promptAnswers: (w.user.profile as any).promptAnswers || [],
          } : null,
        } : null,
      };
    });
  }

  async resolveWarning(
    warningId: string,
    adminId: string,
    action: 'DISMISS' | 'SUSPEND' | 'EXTEND',
    note?: string
  ) {
    const warning = await prisma.adminWarning.findUnique({
      where: { id: warningId },
    });

    if (!warning) throw new Error('Warning not found');

    if (action === 'DISMISS') {
      await prisma.adminWarning.update({
        where: { id: warningId },
        data: {
          status: 'DISMISSED',
          resolvedAt: new Date(),
          resolvedBy: adminId,
          resolutionNote: note || 'Warning dismissed/cleared by admin.',
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: warning.userId,
          adminId,
          action: 'ADMIN_DISMISS_WARNING',
          details: JSON.stringify({ warningId, note }),
        },
      });
    } else if (action === 'SUSPEND') {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: warning.userId },
          data: { status: UserStatus.SUSPENDED },
        }),
        prisma.adminWarning.update({
          where: { id: warningId },
          data: {
            status: 'SUSPENDED',
            resolvedAt: new Date(),
            resolvedBy: adminId,
            resolutionNote: note || 'User suspended by admin following warning review.',
          },
        }),
      ]);

      await prisma.activityLog.create({
        data: {
          userId: warning.userId,
          adminId,
          action: 'ADMIN_SUSPEND_VIA_WARNING',
          details: JSON.stringify({ warningId, note }),
        },
      });
    } else if (action === 'EXTEND') {
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.adminWarning.update({
        where: { id: warningId },
        data: {
          expiresAt: newExpiresAt,
          status: 'ACTIVE',
          resolutionNote: note || 'Deadline extended by 24 hours by admin.',
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: warning.userId,
          adminId,
          action: 'ADMIN_EXTEND_WARNING',
          details: JSON.stringify({ warningId, newExpiresAt, note }),
        },
      });
    }

    try {
      const { io } = await import('../socket');
      if (io) {
        io.emit('admin_warning_updated', {
          warningId,
          action,
        });
      }
    } catch (err) {
      logger.warn('Failed to emit admin_warning_updated socket event on resolve:', err);
    }

    return { success: true };
  }
}
