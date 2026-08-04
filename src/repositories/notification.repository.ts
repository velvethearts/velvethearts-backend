import { prisma } from '../config/database';
import { Notification, NotificationType } from '@prisma/client';

export class NotificationRepository {
  async create(userId: string, type: NotificationType, title: string, content: string, relatedId?: string): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        relatedId,
      },
    });
  }

  async findUnreadByUser(userId: string): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsReadByUser(userId: string): Promise<any> {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markByRelatedId(relatedId: string, userId: string): Promise<any> {
    return prisma.notification.updateMany({
      where: {
        userId,
        relatedId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async upsertUnreadMessageNotification(
    userId: string,
    title: string,
    content: string,
    conversationId: string
  ): Promise<{ notification: Notification; isNew: boolean }> {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: NotificationType.MESSAGE,
        relatedId: conversationId,
        isRead: false,
      },
    });

    if (existing) {
      const updated = await prisma.notification.update({
        where: { id: existing.id },
        data: {
          content,
          createdAt: new Date(),
        },
      });
      return { notification: updated, isNew: false };
    }

    const created = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.MESSAGE,
        title,
        content,
        relatedId: conversationId,
      },
    });

    return { notification: created, isNew: true };
  }
}
