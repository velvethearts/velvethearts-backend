import { prisma } from '../config/database';
import { Report, ReportStatus } from '@prisma/client';

export class ReportRepository {
  async create(reporterId: string, reportedId: string, reason: string, comment?: string): Promise<Report> {
    return prisma.report.create({
      data: {
        reporterId,
        reportedId,
        reason,
        comment,
      },
    });
  }

  async findPendingReports(): Promise<Report[]> {
    return prisma.report.findMany({
      where: { status: ReportStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReportedUserIds(userId: string): Promise<string[]> {
    const reportedByMe = await prisma.report.findMany({
      where: { reporterId: userId },
      select: { reportedId: true },
    });
    return reportedByMe.map((r) => r.reportedId);
  }

  async updateStatus(id: string, status: ReportStatus): Promise<Report> {
    return prisma.report.update({
      where: { id },
      data: {
        status,
        resolvedAt: status !== ReportStatus.PENDING ? new Date() : null,
      },
    });
  }
}
