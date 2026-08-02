import { prisma } from '../config/database';
import { User, ApprovalStatus, UserStatus, Prisma } from '@prisma/client';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { firebaseUid },
    });
  }

  async findPendingVerification(): Promise<(User & { profile: any | null })[]> {
    return prisma.user.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        status: UserStatus.ACTIVE,
      },
      include: {
        profile: {
          include: {
            photos: {
              orderBy: {
                photoOrder: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

 async delete(id: string): Promise<User> {
  return prisma.user.delete({
    where: {
      id,
    },
  });
}
}
