import { BlockRepository } from '../repositories/block.repository';
import { ReportRepository } from '../repositories/report.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { prisma } from '../config/database';

export class SafetyService {
  private blockRepository = new BlockRepository();
  private reportRepository = new ReportRepository();
  private logRepository = new ActivityLogRepository();

  async blockUser(blockerId: string, blockedId: string, reason?: string) {
    if (blockerId === blockedId) {
      throw new Error('You cannot block yourself');
    }

    // Save block
    await this.blockRepository.create(blockerId, blockedId, reason);

    // Clean up connections, likes, and conversations in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Remove any likes
      await tx.like.deleteMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: blockedId },
            { senderId: blockedId, receiverId: blockerId },
          ],
        },
      });

      // 2. Unmatch if they are matched
      const [u1, u2] = [blockerId, blockedId].sort();
      const match = await tx.match.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id: u1,
            user2Id: u2,
          },
        },
      });

      if (match && !match.unmatched) {
        await tx.match.update({
          where: { id: match.id },
          data: {
            unmatched: true,
            unmatchedAt: new Date(),
            unmatchedBy: blockerId,
          },
        });
      }
    });

    // Log block action
    await this.logRepository.create({
      userId: blockerId,
      action: 'BLOCK_USER',
      details: JSON.stringify({ blockedId, reason }),
    });

    return { success: true };
  }

  async reportUser(reporterId: string, reportedId: string, reason: string, comment?: string) {
    if (reporterId === reportedId) {
      throw new Error('You cannot report yourself');
    }

    // Create Report
    await this.reportRepository.create(reporterId, reportedId, reason, comment);

    // Log report action
    await this.logRepository.create({
      userId: reporterId,
      action: 'REPORT_SUBMISSION',
      details: JSON.stringify({ reportedId, reason, comment }),
    });

    // Auto-block the user
    await this.blockUser(reporterId, reportedId, `Auto-blocked following safety report: ${reason}`);

    return { success: true };
  }
}
