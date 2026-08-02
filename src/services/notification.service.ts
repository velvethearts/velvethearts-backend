import { NotificationRepository } from '../repositories/notification.repository';
import { prisma } from '../config/database';

export class NotificationService {
  private notificationRepository = new NotificationRepository();

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const total = await prisma.notification.count({
      where: { userId },
    });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    const pages = Math.ceil(total / limit) || 1;

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages,
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Unauthorized notification action');
    }

    return this.notificationRepository.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepository.markAllAsReadByUser(userId);
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Unauthorized notification action');
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  }
}
