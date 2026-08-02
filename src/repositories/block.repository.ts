import { prisma } from '../config/database';
import { Block } from '@prisma/client';

export class BlockRepository {
  async create(blockerId: string, blockedId: string, reason?: string): Promise<Block> {
    return prisma.block.create({
      data: {
        blockerId,
        blockedId,
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
    const blockedByMe = await prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    });

    const blockedMe = await prisma.block.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    });

    const ids = new Set<string>();
    blockedByMe.forEach((b) => ids.add(b.blockedId));
    blockedMe.forEach((b) => ids.add(b.blockerId));
    return Array.from(ids);
  }
}
