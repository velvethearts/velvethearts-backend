import { prisma } from '../config/database';
import { NotificationType, RewindLetterStatus } from '@prisma/client';
import { io } from '../socket';
import { logger } from '../utils/logger';
import { PushService } from './push.service';
import {
  REWIND_LETTER_DEFAULT_DELIVERY_DAYS,
  REWIND_LETTER_MIN_DELIVERY_DAYS,
  REWIND_LETTER_MAX_DELIVERY_DAYS,
  REWIND_LETTER_DELIVERY_MESSAGE_COUNT,
  REWIND_LETTER_MAX_LENGTH,
} from '../constants/rewind-letter.constants';

export class RewindLetterService {
  private pushService = new PushService();

  /**
   * Write (seal) a rewind letter for a match.
   * One letter per user per match. Author cannot be the same as recipient.
   */
  async writeLetter(authorId: string, matchId: string, content: string, deliveryDays?: number) {
    if (!content || content.trim().length === 0) {
      throw new Error('Letter content cannot be empty');
    }
    if (content.length > REWIND_LETTER_MAX_LENGTH) {
      throw new Error(`Letter must be ${REWIND_LETTER_MAX_LENGTH} characters or fewer`);
    }

    // Validate deliveryDays if supplied
    const days = (typeof deliveryDays === 'number' && Number.isInteger(deliveryDays))
      ? Math.max(REWIND_LETTER_MIN_DELIVERY_DAYS, Math.min(REWIND_LETTER_MAX_DELIVERY_DAYS, deliveryDays))
      : REWIND_LETTER_DEFAULT_DELIVERY_DAYS;

    // Verify match exists, is active, and author is a participant
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.unmatched) throw new Error('This match is no longer active');
    if (match.user1Id !== authorId && match.user2Id !== authorId) {
      throw new Error('You are not part of this match');
    }

    // Check author hasn't already written a letter for this match
    const existing = await prisma.rewindLetter.findUnique({
      where: { matchId_authorId: { matchId, authorId } },
    });
    if (existing) {
      throw new Error('You have already written a letter for this match');
    }

    // Compute deliverAfter: match createdAt + days
    const deliverAfter = new Date(match.createdAt);
    deliverAfter.setDate(deliverAfter.getDate() + days);

    const letter = await prisma.rewindLetter.create({
      data: {
        matchId,
        authorId,
        content: content.trim(),
        deliverAfter,
        status: RewindLetterStatus.SEALED,
      },
    });

    // Partner info for notification and real-time sync
    const partnerId = match.user1Id === authorId ? match.user2Id : match.user1Id;
    const partnerProfile = await prisma.profile.findUnique({
      where: { userId: partnerId },
      select: { name: true },
    });

    // Create an in-app confirmation notification for the author
    try {
      const notif = await prisma.notification.create({
        data: {
          userId: authorId,
          type: NotificationType.REWIND_LETTER,
          title: 'Letter Sealed ✉️',
          content: `Your private Rewind Letter for ${partnerProfile?.name || 'your match'} is safely sealed.`,
          relatedId: matchId,
        },
      });

      if (io) {
        io.to(authorId).emit('notification', { notification: notif });
        // Real-time notification to partner that a letter has been sealed for them
        io.to(partnerId).emit('rewind_letter_sealed', { matchId, authorId });
      }
    } catch (e) {
      logger.warn('[RewindLetter] Failed to create sealed notification:', e);
    }

    logger.info(`[RewindLetter] Letter sealed by ${authorId} for match ${matchId} (unlock in ${days} days)`);
    return {
      id: letter.id,
      matchId: letter.matchId,
      status: letter.status,
      deliverAfter: letter.deliverAfter,
      createdAt: letter.createdAt,
    };
  }

  /**
   * Reschedule delivery time for an already sealed letter.
   * Allowed only while letter is in SEALED state.
   */
  async updateDeliverySchedule(authorId: string, matchId: string, deliveryDays: number) {
    if (!Number.isInteger(deliveryDays) || deliveryDays < REWIND_LETTER_MIN_DELIVERY_DAYS || deliveryDays > REWIND_LETTER_MAX_DELIVERY_DAYS) {
      throw new Error(`Unlock duration must be between ${REWIND_LETTER_MIN_DELIVERY_DAYS} and ${REWIND_LETTER_MAX_DELIVERY_DAYS} days`);
    }

    const letter = await prisma.rewindLetter.findUnique({
      where: { matchId_authorId: { matchId, authorId } },
      include: { match: true },
    });

    if (!letter) {
      throw new Error('Letter not found');
    }
    if (letter.status !== RewindLetterStatus.SEALED) {
      throw new Error('Only sealed letters can be rescheduled');
    }

    const deliverAfter = new Date(letter.match.createdAt);
    deliverAfter.setDate(deliverAfter.getDate() + deliveryDays);

    const updated = await prisma.rewindLetter.update({
      where: { id: letter.id },
      data: { deliverAfter },
    });

    logger.info(`[RewindLetter] Delivery rescheduled for letter ${letter.id} to ${deliverAfter.toISOString()}`);
    return {
      id: updated.id,
      matchId: updated.matchId,
      deliverAfter: updated.deliverAfter,
      status: updated.status,
    };
  }

  /**
   * Get the status of a rewind letter for a match visible to the requesting user.
   * Returns exists/sealed/delivered — never content before delivery.
   */
  async getLetterStatus(userId: string, matchId: string) {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('You are not part of this match');
    }

    // Letter written BY this user
    const myLetter = await prisma.rewindLetter.findUnique({
      where: { matchId_authorId: { matchId, authorId: userId } },
      select: { id: true, status: true, content: true, createdAt: true, deliverAfter: true, deliveredAt: true },
    });

    // Letter written FOR this user (by the other person)
    const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
    const partnerLetter = await prisma.rewindLetter.findUnique({
      where: { matchId_authorId: { matchId, authorId: partnerId } },
      select: { id: true, status: true, deliverAfter: true, deliveredAt: true },
    });

    return {
      myLetter: myLetter
        ? {
            id: myLetter.id,
            status: myLetter.status,
            createdAt: myLetter.createdAt,
            deliverAfter: myLetter.deliverAfter,
            deliveredAt: myLetter.deliveredAt,
            content: myLetter.status === RewindLetterStatus.DELIVERED ? myLetter.content : undefined,
          }
        : null,
      receivedLetter: partnerLetter
        ? {
            id: partnerLetter.id,
            status: partnerLetter.status,
            deliverAfter: partnerLetter.deliverAfter,
            deliveredAt: partnerLetter.deliveredAt,
          }
        : null,
    };
  }

  /**
   * Get the content of a delivered letter. Only the recipient can read it.
   */
  async getDeliveredLetter(userId: string, matchId: string) {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('You are not part of this match');
    }

    const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
    const letter = await prisma.rewindLetter.findUnique({
      where: { matchId_authorId: { matchId, authorId: partnerId } },
    });

    if (!letter) throw new Error('No letter found for this match');
    if (letter.status !== RewindLetterStatus.DELIVERED) {
      throw new Error('This letter has not been delivered yet');
    }

    // Fetch author profile name for display
    const authorProfile = await prisma.profile.findUnique({
      where: { userId: partnerId },
      select: { name: true },
    });

    return {
      id: letter.id,
      content: letter.content,
      authorName: authorProfile?.name || 'Your match',
      deliveredAt: letter.deliveredAt,
      createdAt: letter.createdAt,
    };
  }

  /**
   * Void all sealed letters for a match (called during unmatch/block/grace-close).
   */
  async voidLettersByMatch(matchId: string) {
    await prisma.rewindLetter.updateMany({
      where: { matchId, status: RewindLetterStatus.SEALED },
      data: { status: RewindLetterStatus.VOIDED },
    });
  }

  /**
   * Scheduled sweep: deliver letters whose time has come or whose
   * conversation has enough messages.
   */
  async sweepAndDeliverLetters() {
    const now = new Date();

    // 1. Time-based delivery: sealed letters past their deliverAfter deadline
    const timeReady = await prisma.rewindLetter.findMany({
      where: {
        status: RewindLetterStatus.SEALED,
        deliverAfter: { lte: now },
      },
      include: { match: true },
    });

    // 2. Message-count-based delivery: sealed letters whose conversation
    //    has >= DELIVERY_MESSAGE_COUNT messages
    const sealedLetters = await prisma.rewindLetter.findMany({
      where: {
        status: RewindLetterStatus.SEALED,
        deliverAfter: { gt: now }, // not yet time-eligible — check message count
      },
      include: {
        match: {
          include: { conversation: true },
        },
      },
    });

    const messageReady: typeof sealedLetters = [];
    for (const letter of sealedLetters) {
      if (!letter.match.conversation) continue;
      const messageCount = await prisma.message.count({
        where: { conversationId: letter.match.conversation.id },
      });
      if (messageCount >= REWIND_LETTER_DELIVERY_MESSAGE_COUNT) {
        messageReady.push(letter);
      }
    }

    const allReady = [...timeReady, ...messageReady];
    if (allReady.length === 0) return;

    for (const letter of allReady) {
      try {
        // Mark as delivered
        await prisma.rewindLetter.update({
          where: { id: letter.id },
          data: {
            status: RewindLetterStatus.DELIVERED,
            deliveredAt: now,
          },
        });

        // Determine recipient and author info
        const recipientId = letter.match.user1Id === letter.authorId
          ? letter.match.user2Id
          : letter.match.user1Id;

        const authorProfile = await prisma.profile.findUnique({
          where: { userId: letter.authorId },
          select: { name: true },
        });

        const recipientProfile = await prisma.profile.findUnique({
          where: { userId: recipientId },
          select: { name: true },
        });

        // 1. Create Recipient Notification
        const recipientNotif = await prisma.notification.create({
          data: {
            userId: recipientId,
            type: NotificationType.REWIND_LETTER,
            title: 'A letter arrives ✉️',
            content: `${authorProfile?.name || 'Your match'} wrote you a Rewind Letter when you first connected.`,
            relatedId: letter.matchId,
          },
        });

        // 2. Create Author Notification
        const authorNotif = await prisma.notification.create({
          data: {
            userId: letter.authorId,
            type: NotificationType.REWIND_LETTER,
            title: 'Letter Delivered ✉️',
            content: `Your Rewind Letter has been delivered to ${recipientProfile?.name || 'your match'}.`,
            relatedId: letter.matchId,
          },
        });

        // 3. Emit real-time socket events
        if (io) {
          // Notify Recipient
          io.to(recipientId).emit('rewind_letter_delivered', {
            matchId: letter.matchId,
            letterId: letter.id,
            authorName: authorProfile?.name || 'Your match',
            isAuthor: false,
          });
          io.to(recipientId).emit('notification', {
            notification: recipientNotif,
          });

          // Notify Author
          io.to(letter.authorId).emit('rewind_letter_delivered', {
            matchId: letter.matchId,
            letterId: letter.id,
            partnerName: recipientProfile?.name || 'Your match',
            isAuthor: true,
          });
          io.to(letter.authorId).emit('notification', {
            notification: authorNotif,
          });
        }

        // 4. Send Web Push Notifications
        this.pushService.sendPushNotification(recipientId, {
          title: 'A letter arrives ✉️',
          body: `${authorProfile?.name || 'Your match'} wrote you a Rewind Letter when you first connected.`,
          url: '/?tab=chat',
          data: { tab: 'chat', matchId: letter.matchId }
        }).catch(() => {});

        this.pushService.sendPushNotification(letter.authorId, {
          title: 'Letter Delivered ✉️',
          body: `Your Rewind Letter has been delivered to ${recipientProfile?.name || 'your match'}.`,
          url: '/?tab=chat',
          data: { tab: 'chat', matchId: letter.matchId }
        }).catch(() => {});

        logger.info(`[RewindLetter] Delivered letter ${letter.id} to user ${recipientId} and notified author ${letter.authorId}`);
      } catch (err: any) {
        logger.error(`[RewindLetter] Failed to deliver letter ${letter.id}:`, err?.message || err);
      }
    }
  }
}
