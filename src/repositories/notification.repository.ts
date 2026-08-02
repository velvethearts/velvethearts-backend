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
}
