import { prisma } from '../config/database';
import { Match, UserStatus } from '@prisma/client';

export class MatchRepository {
  async create(user1Id: string, user2Id: string): Promise<Match> {
    // Standardize IDs: user1Id should be lexicographically smaller to prevent duplicates
    const [u1, u2] = [user1Id, user2Id].sort();
    return prisma.match.create({
      data: {
        user1Id: u1,
        user2Id: u2,
      },
    });
  }

  async find(user1Id: string, user2Id: string): Promise<Match | null> {
    const [u1, u2] = [user1Id, user2Id].sort();
    return prisma.match.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id: u1,
          user2Id: u2,
        },
      },
    });
  }

  async findById(id: string): Promise<Match | null> {
    return prisma.match.findUnique({
      where: { id },
    });
  }

  async findActiveMatchesByUser(userId: string): Promise<any[]> {
    return prisma.match.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
        unmatched: false,
        user1: { status: UserStatus.ACTIVE },
        user2: { status: UserStatus.ACTIVE },
      },
      include: {
        user1: {
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
        user2: {
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
    });
  }

  async unmatch(matchId: string, unmatchedBy: string): Promise<Match> {
    return prisma.match.update({
      where: { id: matchId },
      data: {
        unmatched: true,
        unmatchedAt: new Date(),
        unmatchedBy,
      },
    });
  }

  async delete(matchId: string): Promise<Match> {
    return prisma.match.delete({
      where: { id: matchId },
    });
  }
}
