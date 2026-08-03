import { BlockRepository } from '../repositories/block.repository';
import { ReportRepository } from '../repositories/report.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { prisma } from '../config/database';

export class SafetyService {
  private blockRepository = new BlockRepository();
  private reportRepository = new ReportRepository();
  private logRepository = new ActivityLogRepository();

  private async resolveUserId(idOrProfileId: string): Promise<string> {
    if (!idOrProfileId) return idOrProfileId;
    const user = await prisma.user.findUnique({ where: { id: idOrProfileId } });
    if (user) return user.id;

    const profile = await prisma.profile.findUnique({ where: { id: idOrProfileId } });
    if (profile) return profile.userId;

    return idOrProfileId;
  }

  async blockUser(blockerIdInput: string, blockedIdInput: string, reason?: string) {
    const blockerId = await this.resolveUserId(blockerIdInput);
    const blockedId = await this.resolveUserId(blockedIdInput);

    if (blockerId === blockedId) {
      return { success: true };
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

  async reportUser(reporterIdInput: string, reportedIdInput: string, reason: string, comment?: string) {
    const reporterId = await this.resolveUserId(reporterIdInput);
    const reportedId = await this.resolveUserId(reportedIdInput);

    if (reporterId === reportedId) {
      return { success: true };
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

  async unblockUser(blockerIdInput: string, blockedIdInput: string) {
    const blockerId = await this.resolveUserId(blockerIdInput);
    const blockedId = await this.resolveUserId(blockedIdInput);
    if (blockerId === blockedId) {
      throw new Error('Invalid unblock parameters');
    }

    const deleted = await this.blockRepository.delete(blockerId, blockedId);

    // If there was a match auto-unmatched by this blocker during block, restore it
    const [u1, u2] = [blockerId, blockedId].sort();
    const match = await prisma.match.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id: u1,
          user2Id: u2,
        },
      },
    });

    if (match && match.unmatched && match.unmatchedBy === blockerId) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          unmatched: false,
          unmatchedAt: null,
          unmatchedBy: null,
        },
      });

      // Restore mutual likes so connection status is active
      await prisma.like.upsert({
        where: { senderId_receiverId: { senderId: blockerId, receiverId: blockedId } },
        create: { senderId: blockerId, receiverId: blockedId },
        update: {},
      });

      await prisma.like.upsert({
        where: { senderId_receiverId: { senderId: blockedId, receiverId: blockerId } },
        create: { senderId: blockedId, receiverId: blockedId },
        update: {},
      });
    }

    // Log unblock action
    await this.logRepository.create({
      userId: blockerId,
      action: 'UNBLOCK_USER',
      details: JSON.stringify({ blockedId }),
    });

    return { success: true, deleted: !!deleted };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await this.blockRepository.findBlocksByBlocker(userId);

    return blocks.map((b) => {
      const prof = b.blocked?.profile;
      const primaryPhoto = prof?.photos?.find((p) => p.isPrimary)?.secureUrl || prof?.photos?.[0]?.secureUrl || null;

      return {
        id: b.id,
        blockedUserId: b.blockedId,
        name: prof?.name || 'Blocked User',
        avatar: primaryPhoto,
        city: prof?.city || null,
        reason: b.reason || null,
        blockedAt: b.createdAt,
      };
    });
  }
}
