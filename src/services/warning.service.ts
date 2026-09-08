import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class WarningService {
  /**
   * Retrieves the active warning (if any) for a given user.
   */
  async getActiveWarningForUser(userId: string) {
    if (!userId) return null;

    const warning = await prisma.adminWarning.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'APPEALED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { name: true, role: true }
        }
      }
    });

    if (!warning) return null;

    const isExpired = new Date() > warning.expiresAt;
    const remainingMs = Math.max(0, warning.expiresAt.getTime() - Date.now());

    return {
      id: warning.id,
      violationType: warning.violationType,
      message: warning.message,
      deadlineHours: warning.deadlineHours,
      expiresAt: warning.expiresAt,
      remainingMs,
      autoSuspend: warning.autoSuspend,
      status: warning.status,
      appealText: warning.appealText,
      appealPhotos: warning.appealPhotos,
      appealedAt: warning.appealedAt,
      isExpired,
      createdAt: warning.createdAt,
    };
  }

  /**
   * Allows the user to submit an explanation and attach proof images (e.g. ID, alternate photos).
   * Freezes the auto-suspension countdown by changing status to 'APPEALED'.
   */
  async submitAppeal(warningId: string, userId: string, appealText: string, appealPhotos: string[] = []) {
    if (!warningId || !userId) {
      throw new Error('Warning ID and User ID are required.');
    }

    if (!appealText || !appealText.trim()) {
      throw new Error('Please provide an explanation for your appeal.');
    }

    const warning = await prisma.adminWarning.findUnique({
      where: { id: warningId },
    });

    if (!warning) {
      throw new Error('Warning not found.');
    }

    if (warning.userId !== userId) {
      throw new Error('Unauthorized action on this warning.');
    }

    if (warning.status === 'DISMISSED' || warning.status === 'RESOLVED') {
      throw new Error('This warning has already been resolved or cleared.');
    }

    const updated = await prisma.adminWarning.update({
      where: { id: warningId },
      data: {
        appealText: appealText.trim(),
        appealPhotos: Array.isArray(appealPhotos) ? appealPhotos : [],
        appealedAt: new Date(),
        status: 'APPEALED', // Pauses/freezes auto-suspend countdown!
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'WARNING_APPEAL_SUBMITTED',
        details: JSON.stringify({
          warningId,
          appealText: appealText.trim(),
          photosCount: appealPhotos?.length || 0,
        }),
      },
    });

    logger.info(`[WarningService] Appeal submitted by user ${userId} for warning ${warningId} with ${appealPhotos?.length || 0} photo(s).`);

    return updated;
  }
}
