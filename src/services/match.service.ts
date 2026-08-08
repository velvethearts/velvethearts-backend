import { LikeRepository } from '../repositories/like.repository';
import { MatchRepository } from '../repositories/match.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { ApprovalStatus, NotificationType, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { io } from '../socket'; 
import { PushService } from './push.service';

export class MatchService {
  private likeRepository = new LikeRepository();
  private matchRepository = new MatchRepository();
  private logRepository = new ActivityLogRepository();
  private pushService = new PushService();

  async likeProfile(senderId: string, receiverId: string, isSuper: boolean = false, comment: string | null = null) {
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
      // 1. Save Like with optional comment
      await tx.like.create({
        data: {
          senderId,
          receiverId,
          isSuper: Boolean(isSuper),
          comment: comment || null,
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
          } else {
            // Delete all old chat messages so the re-matched pair starts a fresh clean chat
            await tx.message.deleteMany({
              where: { conversationId: conversation.id },
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

        // Create opening comments/messages or connection icebreaker
        let messagesCreated = 0;

        if (mutualLike.comment) {
          await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: receiverId,
              text: mutualLike.comment
            }
          });
          messagesCreated++;
        }

        if (comment) {
          await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: senderId,
              text: comment
            }
          });
          messagesCreated++;
        }

        if (messagesCreated === 0) {
          await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: receiverId,
              text: `It's a connection! I read your story and would love to get to know you.`
            }
          });
        }

        // Dispatch Match Notifications
        await tx.notification.createMany({
          data: [
            {
              userId: senderId,
              type: NotificationType.MATCH,
              title: 'New Connection!',
              content: 'You have a new match on Velvet Hearts!',
              relatedId: conversation.id
            },
            {
              userId: receiverId,
              type: NotificationType.MATCH,
              title: 'New Connection!',
              content: 'You have a new match on Velvet Hearts!',
              relatedId: conversation.id
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

      // Notify both users in real time via socket
      io.to(senderId).emit('matchCreated', {
        conversationId: result.conversationId,
      });

      io.to(receiverId).emit('matchCreated', {
        conversationId: result.conversationId,
      });

      // Web Push notification to both matched users
      this.pushService.sendPushNotification(receiverId, {
        title: 'It\'s a Connection! 💕',
        body: 'You have a new mutual match on Velvet Hearts!',
        url: '/?tab=chat',
        data: { tab: 'chat', conversationId: result.conversationId }
      }).catch(() => {});

      this.pushService.sendPushNotification(senderId, {
        title: 'It\'s a Connection! 💕',
        body: 'You have a new mutual match on Velvet Hearts!',
        url: '/?tab=chat',
        data: { tab: 'chat', conversationId: result.conversationId }
      }).catch(() => {});
    } else {
      // Web Push notification for single interest/like
      this.pushService.sendPushNotification(receiverId, {
        title: 'New Interest! 💕',
        body: 'Someone is interested in your profile on Velvet Hearts!',
        url: '/?tab=notifications',
        data: { tab: 'notifications', senderId }
      }).catch(() => {});
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

    // Delete all messages in the conversation so re-matching starts a fresh chat
    const conversation = await prisma.conversation.findUnique({
      where: { matchId },
    });
    if (conversation) {
      await prisma.message.deleteMany({
        where: { conversationId: conversation.id },
      });
    }

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
        gender: prof?.gender || 'Woman',
        showGender: prof?.showGender ?? true,
        orientation: prof?.orientation || 'Straight',
        showOrientation: prof?.showOrientation ?? true,
        relationshipIntent: prof?.relationshipIntent || 'Long-term Relationship',
        relationshipStatus: prof?.relationshipStatus || 'Single',
        interests: prof?.interests || [],
        story: prof?.story || '',
        hasDisability: prof?.hasDisability ?? false,
        disabilityInfo: prof?.disabilityInfo || '',
        showDisability: prof?.showDisability ?? false,
        verified: partner.approvalStatus === 'APPROVED',
        isPremium: prof?.isPremium || false,
        photo: prof?.photos?.[0]?.secureUrl || '',
        photos: prof?.photos?.map((p: any) => p.secureUrl) || [],
        createdAt: m.createdAt,
      };
    });
  }

  async getReceivedInvites(userId: string) {
    const sentLikes = await this.likeRepository.findSentLikesByUser(userId);
    const activeMatches = await this.matchRepository.findActiveMatchesByUser(userId);
    const excludedSenderIds = new Set<string>(sentLikes.map((like) => like.receiverId));

    activeMatches.forEach((match) => {
      excludedSenderIds.add(match.user1Id === userId ? match.user2Id : match.user1Id);
    });

    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
    });
    blocks.forEach((b) => {
      excludedSenderIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    });

    const receivedLikes = await prisma.like.findMany({
      where: {
        receiverId: userId,
        senderId: {
          notIn: Array.from(excludedSenderIds),
          not: userId,
        },
        sender: {
          status: UserStatus.ACTIVE,
          approvalStatus: { not: ApprovalStatus.REJECTED },
          profile: {
            isNot: null,
          },
        },
      },
      include: {
        sender: {
          include: {
            profile: {
              include: {
                photos: {
                  orderBy: { photoOrder: 'asc' },
                },
                promptAnswers: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return receivedLikes.map((like) => {
      const user = like.sender;
      const prof = user.profile!;
      const dobDate = new Date(prof.dob);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const mDiff = today.getMonth() - dobDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

      return {
        id: user.id,
        inviteId: like.id,
        invitedAt: like.createdAt,
        isSuper: Boolean(like.isSuper),
        isSuperSpark: Boolean(like.isSuper),
        name: prof.name,
        age,
        city: prof.city,
        gender: prof.gender,
        showGender: prof.showGender,
        orientation: prof.orientation,
        showOrientation: prof.showOrientation,
        relationshipIntent: prof.relationshipIntent,
        relationshipStatus: prof.relationshipStatus,
        interests: prof.interests,
        languages: prof.languages || [],
        education: prof.education || '',
        occupation: prof.occupation || '',
        story: prof.story,
        hasDisability: prof.hasDisability,
        disabilityInfo: prof.disabilityInfo,
        showDisability: prof.showDisability,
        verified: user.approvalStatus === ApprovalStatus.APPROVED,
        isPremium: prof.isPremium,
        photo: prof.photos[0]?.secureUrl || '',
        photos: prof.photos.map((p) => p.secureUrl),
        promptAnswers: prof.promptAnswers,
      };
    });
  }

  async getSentInvites(userId: string) {
    const activeMatches = await this.matchRepository.findActiveMatchesByUser(userId);
    const matchedUserIds = new Set<string>();
    activeMatches.forEach((m) => {
      matchedUserIds.add(m.user1Id === userId ? m.user2Id : m.user1Id);
    });

    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
    });
    blocks.forEach((b) => {
      matchedUserIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    });

    const sentLikes = await prisma.like.findMany({
      where: {
        senderId: userId,
        receiverId: {
          notIn: Array.from(matchedUserIds),
          not: userId,
        },
        receiver: {
          status: UserStatus.ACTIVE,
          approvalStatus: { not: ApprovalStatus.REJECTED },
          profile: { isNot: null },
        },
      },
      include: {
        receiver: {
          include: {
            profile: {
              include: {
                photos: { orderBy: { photoOrder: 'asc' } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sentLikes.map((like) => {
      const user = like.receiver;
      const prof = user.profile!;
      let age = 21;
      if (prof?.dob) {
        const dobDate = new Date(prof.dob);
        const today = new Date();
        let calculatedAge = today.getFullYear() - dobDate.getFullYear();
        const mDiff = today.getMonth() - dobDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < dobDate.getDate())) calculatedAge--;
        age = calculatedAge;
      }

      return {
        id: user.id,
        inviteId: like.id,
        invitedAt: like.createdAt,
        isSuper: Boolean(like.isSuper),
        isSuperSpark: Boolean(like.isSuper),
        name: prof.name,
        age,
        city: prof.city,
        gender: prof.gender,
        relationshipIntent: prof.relationshipIntent,
        relationshipStatus: prof.relationshipStatus,
        interests: prof.interests || [],
        story: prof.story || '',
        photo: prof.photos[0]?.secureUrl || '',
        photos: prof.photos.map((p) => p.secureUrl),
      };
    });
  }
}
