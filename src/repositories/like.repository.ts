import { prisma } from '../config/database';
import { Like } from '@prisma/client';

export class LikeRepository {
  async create(senderId: string, receiverId: string): Promise<Like> {
    return prisma.like.create({
      data: {
        senderId,
        receiverId,
      },
    });
  }

  async find(senderId: string, receiverId: string): Promise<Like | null> {
    return prisma.like.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });
  }

  async delete(senderId: string, receiverId: string): Promise<Like | null> {
    try {
      return await prisma.like.delete({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId,
          },
        },
      });
    } catch (e) {
      return null; // Like didn't exist or already removed
    }
  }

  async findSentLikesByUser(senderId: string): Promise<Like[]> {
    return prisma.like.findMany({
      where: { senderId },
    });
  }

  async findReceivedLikesByUser(receiverId: string): Promise<Like[]> {
    return prisma.like.findMany({
      where: { receiverId },
    });
  }
}
