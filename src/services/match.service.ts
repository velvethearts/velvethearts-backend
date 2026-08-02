import { LikeRepository } from '../repositories/like.repository';
import { MatchRepository } from '../repositories/match.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { NotificationType } from '@prisma/client';
import { prisma } from '../config/database';
import { io } from '../socket'; 

export class MatchService {
  private likeRepository = new LikeRepository();
  private matchRepository = new MatchRepository();
  private logRepository = new ActivityLogRepository();

  async likeProfile(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new Error('You cannot like your own profile');
    }

    // Check block constraints first (cannot like if blocked/blocker exists)
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId }
        ]
      }
    });

    if (block) {
      throw new Error('Cannot like this profile due to privacy settings or block constraints.');
    }

    // Verify target user is active
    const target = await prisma.user.findUnique({
      where: { id: receiverId }
    });
    if (!target || target.status !== 'ACTIVE') {
      throw new Error('This profile is no longer active.');
    }

    // Check if like already exists
    const existingLike = await this.likeRepository.find(senderId, receiverId);
    if (existingLike) {
      return { match: false, message: 'Profile already liked' };
    }

    // Run matching logic in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Save Like
      await tx.like.create({
        data: {
          senderId,
          receiverId
        }
      });

      // 2. Check if mutual like exists
      const mutualLike = await tx.like.findUnique({
        where: {
          senderId_receiverId: {
            senderId: receiverId,
            receiverId: senderId
          }
        }
      });

      if (mutualLike) {
        // Create Match (sort IDs to prevent duplicates)
        const [u1, u2] = [senderId, receiverId].sort();

        // (user1Id, user2Id) is a unique constraint, and unmatching only
        // flips `unmatched: true` rather than deleting the row — so if
        // these two users matched before, an old row already exists here.
        // Revive it instead of trying to insert a duplicate.
        let match = await tx.match.findUnique({
          where: {
            user1Id_user2Id: {
              user1Id: u1,
              user2Id: u2,
            },
          },
        });

        let conversation;

        if (match) {
          match = await tx.match.update({
            where: { id: match.id },
            data: {
              unmatched: false,
              unmatchedAt: null,
              unmatchedBy: null,
            },
          });

          conversation = await tx.conversation.findUnique({
            where: { matchId: match.id },
          });

          if (!conversation) {
            conversation = await tx.conversation.create({
              data: {
                matchId: match.id,
                participants: {
                  create: [
                    { userId: senderId },
                    { userId: receiverId }
                  ]
                }
              }
            });
          }
        } else {
          match = await tx.match.create({
            data: {
              user1Id: u1,
              user2Id: u2
            }
          });

          // Initialize Conversation for the match
          conversation = await tx.conversation.create({
            data: {
              matchId: match.id,
              participants: {
                create: [
                  { userId: senderId },
                  { userId: receiverId }
                ]
              }
            }
          });
        }

        // Create opening system/connection message
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: receiverId,
            text: `It's a connection! I read your story and would love to get to know you.`
          }
        });

        // Dispatch Match Notifications
        await tx.notification.createMany({
          data: [
            {
              userId: senderId,
              type: NotificationType.MATCH,
              title: 'New Connection!',
              content: 'You have a new match on Velvet Hearts!',
              relatedId: match.id
            },
            {
              userId: receiverId,
              type: NotificationType.MATCH,
              title: 'New Connection!',
              content: 'You have a new match on Velvet Hearts!',
              relatedId: match.id
            }
          ]
        });
        // Notify both users instantly
        io.to(senderId).emit("matchCreated", {
          conversationId: conversation.id,
        });

        io.to(receiverId).emit("matchCreated", {
          conversationId: conversation.id,
        });

        return {
          match: true,
          conversationId: conversation.id,
        };
              }

      // If not mutual, push general Like notification
      await tx.notification.create({
        data: {
          userId: receiverId,
          type: NotificationType.LIKE,
          title: 'Someone liked you',
          content: 'A member has shown interest in your profile.',
          relatedId: senderId
        }
      });

      return { match: false };
    });

    // Logging Like action
    await this.logRepository.create({
      userId: senderId,
      action: 'LIKE_PROFILE',
      details: JSON.stringify({ receiverId }),
    });

      if (result.match) {
    // Log Match Creation
    await this.logRepository.create({
      userId: senderId,
      action: 'MATCH_CREATE',
      details: JSON.stringify({ user2Id: receiverId }),
    });

    // Notify both users in real time
    io.to(senderId).emit('matchCreated', {
      conversationId: result.conversationId,
    });

    io.to(receiverId).emit('matchCreated', {
      conversationId: result.conversationId,
    });
  }

    return result;
  }

  async unlikeProfile(senderId: string, receiverId: string) {
    await this.likeRepository.delete(senderId, receiverId);

    await this.logRepository.create({
      userId: senderId,
      action: 'UNDO_LIKE',
      details: JSON.stringify({ receiverId }),
    });

    return { success: true };
  }

  async unmatch(userId: string, matchId: string) {
    const match = await this.matchRepository.findById(matchId);
    if (!match) throw new Error('Match not found');

    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('Unauthorized unmatch action');
    }

    // Remove both likes so the users can discover each other again
    await prisma.like.deleteMany({
      where: {
        OR: [
          {
            senderId: match.user1Id,
            receiverId: match.user2Id,
          },
          {
            senderId: match.user2Id,
            receiverId: match.user1Id,
          },
        ],
      },
    });

    await this.matchRepository.unmatch(matchId, userId);

    await this.logRepository.create({
      userId,
      action: 'UNMATCH_USER',
      details: JSON.stringify({ matchId }),
    });

    return { success: true };
  }

  async getConnections(userId: string) {
    const activeMatches = await this.matchRepository.findActiveMatchesByUser(userId);

    return activeMatches.map((m) => {
      const partner = m.user1Id === userId ? m.user2 : m.user1;
      const prof = partner.profile;

      // Compute age from dob
      let age = 21; // Default fallback
      if (prof?.dob) {
        const dobDate = new Date(prof.dob);
        const today = new Date();
        let calculatedAge = today.getFullYear() - dobDate.getFullYear();
        const mDiff = today.getMonth() - dobDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < dobDate.getDate())) {
          calculatedAge--;
        }
        age = calculatedAge;
      }

      return {
        id: partner.id,
        matchId: m.id,
        name: prof?.name || 'Velvet Hearts Member',
        age,
        city: prof?.city || '',
        photo: prof?.photos?.[0]?.secureUrl || '',
        relationshipIntent: prof?.relationshipIntent || 'Long-term Relationship',
        verified: partner.approvalStatus === 'APPROVED',
        isPremium: prof?.isPremium || false,
        createdAt: m.createdAt,
      };
    });
  }
}