import { prisma } from '../config/database';
import { ActivityLog } from '@prisma/client';

export class ActivityLogRepository {
  async create(data: { userId?: string; adminId?: string; action: string; details?: string; ipAddress?: string; userAgent?: string }): Promise<ActivityLog> {
    return prisma.activityLog.create({
      data: {
        userId: data.userId,
        adminId: data.adminId,
        action: data.action,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async findByUser(userId: string): Promise<ActivityLog[]> {
    return prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(limit = 100): Promise<ActivityLog[]> {
    return prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
