import { prisma } from '../config/database';
import { Block } from '@prisma/client';

export class BlockRepository {
  async create(blockerId: string, blockedId: string, reason?: string): Promise<Block> {
    const blockedUser = await prisma.user.findUnique({
      where: { id: blockedId },
      select: { email: true, phoneNumber: true, deviceId: true }
    });

    return prisma.block.create({
      data: {
        blockerId,
        blockedId,
        blockedEmail: blockedUser?.email || null,
        blockedPhone: blockedUser?.phoneNumber || null,
        deviceId: blockedUser?.deviceId || null,
        reason,
      },
    });
  }

  async find(blockerId: string, blockedId: string): Promise<Block | null> {
    return prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
  }

  async delete(blockerId: string, blockedId: string): Promise<Block | null> {
    try {
      return await prisma.block.delete({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });
    } catch (e) {
      return null;
    }
  }

  async findBlockedUserIds(userId: string): Promise<string[]> {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phoneNumber: true, deviceId: true }
    });

    // Blocks created by me
    const blockedByMe = await prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true, blockedEmail: true, blockedPhone: true, deviceId: true },
    });

    // Blocks directed at me, my email, my phone, or my device
    const whereOr: any[] = [{ blockedId: userId }];
    if (currentUser?.email) whereOr.push({ blockedEmail: currentUser.email });
    if (currentUser?.phoneNumber) whereOr.push({ blockedPhone: currentUser.phoneNumber });
    if (currentUser?.deviceId) whereOr.push({ deviceId: currentUser.deviceId });

    const blockedMe = await prisma.block.findMany({
      where: { OR: whereOr },
      select: { blockerId: true },
    });

    const ids = new Set<string>();
    const emails = new Set<string>();
    const phones = new Set<string>();
    const devices = new Set<string>();

    blockedByMe.forEach((b) => {
      ids.add(b.blockedId);
      if (b.blockedEmail) emails.add(b.blockedEmail);
      if (b.blockedPhone) phones.add(b.blockedPhone);
      if (b.deviceId) devices.add(b.deviceId);
    });

    blockedMe.forEach((b) => ids.add(b.blockerId));

    // Find any re-created user accounts matching blocked emails, phones, or device IDs
    if (emails.size > 0 || phones.size > 0 || devices.size > 0) {
      const userOr: any[] = [];
      if (emails.size > 0) userOr.push({ email: { in: Array.from(emails) } });
      if (phones.size > 0) userOr.push({ phoneNumber: { in: Array.from(phones) } });
      if (devices.size > 0) userOr.push({ deviceId: { in: Array.from(devices) } });

      const reCreatedUsers = await prisma.user.findMany({
        where: { OR: userOr },
        select: { id: true }
      });
      reCreatedUsers.forEach(u => ids.add(u.id));
    }

    return Array.from(ids);
  }

  async findBlocksByBlocker(blockerId: string) {
    return prisma.block.findMany({
      where: { blockerId },
      include: {
        blocked: {
          include: {
            profile: {
              include: {
                photos: {
                  orderBy: { photoOrder: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
