import { prisma } from '../config/database';
import { BlockRepository } from '../repositories/block.repository';
import { LikeRepository } from '../repositories/like.repository';
import { UserStatus, ApprovalStatus } from '@prisma/client';
import { calculateStateDistance } from '../constants/indiaLocations';

export interface DiscoverFilters {
  gender?: string;
  relationshipIntent?: string;
  city?: string;
  ageMin?: number;
  ageMax?: number;
  languages?: string[];
  education?: string;
  occupation?: string;
  interests?: string[];
}

export function calculateProfileCompletion(profile: any): number {
  if (!profile) return 0;
  let score = 0;
  
  // Photo depth scoring: rewards adding slots 1-6 as promised in marketing
  const photoCount = profile.photos?.length || 0;
  if (photoCount >= 1) score += 20; // Primary photo baseline
  if (photoCount >= 2) score += 10; // Hobby/activity photo (+60% more views)
  if (photoCount >= 3) score += 15; // Travel/adventure photo (+80% more replies / 4.2x)
  if (photoCount >= 4) score += 10; // Candid moment (4.2x more interactions)
  if (photoCount >= 5) score += 5;  // Dressed-up photo (Stand out in feed)
  if (photoCount >= 6) score += 5;  // Full 6-photo gallery completion

  // Voice Intro: 30-sec audio intro (delivering on "3x profile visits")
  if (profile.voiceIntroUrl) score += 25;

  // Verified Rosette: Biometric face verification trust boost
  if (profile.verified) score += 20;

  if (profile.story && profile.story.length >= 20) score += 20;
  if (profile.promptAnswers && profile.promptAnswers.length > 0) score += 15;
  if (profile.interests && profile.interests.length >= 3) score += 10;
  if (profile.city && profile.city.length >= 2) score += 10;
  if (profile.gender && profile.orientation) score += 10;
  if (profile.dob) score += 10;
  if (profile.relationshipIntent) score += 5;
  
  return score;
}

import { NotificationType } from '@prisma/client';
import { io } from '../socket';

export class DiscoverService {
  private blockRepository = new BlockRepository();
  private likeRepository = new LikeRepository();

  async getRecommendations(
    userId: string, 
    filters: DiscoverFilters, 
    page = 1, 
    limit = 20, 
    sortBy = 'default'
  ) {
    const excludeIds = new Set<string>();
    excludeIds.add(userId);

    // Exclude blocked, liked, matched, and reported users in parallel
    const [currentUserProfile, blockedIds, sentLikes, matches, reports] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: { city: true }
      }),
      this.blockRepository.findBlockedUserIds(userId),
      this.likeRepository.findSentLikesByUser(userId),
      prisma.match.findMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId },
          ],
          unmatched: false,
        },
        select: {
          user1Id: true,
          user2Id: true,
        },
      }),
      prisma.report.findMany({
        where: {
          OR: [
            { reporterId: userId },
            { reportedId: userId }
          ]
        },
        select: {
          reporterId: true,
          reportedId: true,
        },
      })
    ]);

    blockedIds.forEach((id) => excludeIds.add(id));
    sentLikes.forEach((like) => excludeIds.add(like.receiverId));
    matches.forEach((m) => {
      excludeIds.add(m.user1Id);
      excludeIds.add(m.user2Id);
    });
    reports.forEach((r) => {
      excludeIds.add(r.reporterId);
      excludeIds.add(r.reportedId);
    });

    // Build query filters for Prisma
    const whereClause: any = {
      id: {
        notIn: Array.from(excludeIds),
      },
      status: UserStatus.ACTIVE,
      approvalStatus: { not: ApprovalStatus.REJECTED },
      profile: {
        isNot: null,
      },
    };

    const profileFilters: any = {
      isPaused: false,
    };

    if (filters.gender && filters.gender !== 'All') {
      const g = filters.gender.toLowerCase();
      if (g === 'woman' || g === 'female') {
        profileFilters.gender = { in: ['Woman', 'woman', 'Female', 'female', 'Women', 'women'] };
      } else if (g === 'man' || g === 'male') {
        profileFilters.gender = { in: ['Man', 'man', 'Male', 'male', 'Men', 'men'] };
      } else {
        profileFilters.gender = { contains: filters.gender, mode: 'insensitive' };
      }
    }

    if (filters.relationshipIntent && filters.relationshipIntent !== 'All') {
      profileFilters.relationshipIntent = {
        contains: filters.relationshipIntent.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.city) {
      profileFilters.city = {
        contains: filters.city.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.education) {
      profileFilters.education = {
        equals: filters.education.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.occupation) {
      profileFilters.occupation = {
        contains: filters.occupation.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.languages && filters.languages.length > 0) {
      profileFilters.languages = {
        hasSome: filters.languages,
      };
    }

    if (filters.interests && filters.interests.length > 0) {
      profileFilters.interests = {
        hasSome: filters.interests,
      };
    }

    // [M-9 FIX] Push DOB range calculation into Prisma to filter candidates at the database layer
    const ageMin = filters.ageMin ?? 18;
    const ageMax = filters.ageMax ?? 100;
    const today = new Date();
    const dobMin = new Date(today.getFullYear() - ageMax - 1, today.getMonth(), today.getDate());
    const dobMax = new Date(today.getFullYear() - ageMin, today.getMonth(), today.getDate());

    profileFilters.dob = {
      gte: dobMin,
      lte: dobMax,
    };

    if (Object.keys(profileFilters).length > 0) {
      whereClause.profile = {
        is: profileFilters,
      };
    }

    // Fetch candidate users
    const candidates = await prisma.user.findMany({
      where: whereClause,
      include: {
        profile: {
          include: {
            photos: {
              orderBy: {
                photoOrder: 'asc',
              },
            },
            promptAnswers: true,
          },
        },
      },
    });

    // Map candidates, calculate age and profileCompletion
    let mapped = candidates.map((u) => {
      const prof = u.profile!;
      const today = new Date();
      const dobDate = new Date(prof.dob);
      let age = today.getFullYear() - dobDate.getFullYear();
      const mDiff = today.getMonth() - dobDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

      // Calculate real inter-state distance
      const distInfo = calculateStateDistance(currentUserProfile?.city, prof.city);

      return {
        id: u.id,
        userId: u.id,
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
        verified: Boolean(prof.verified),
        isPremium: prof.isPremium,
        photos: prof.photos.map((p) => p.secureUrl),
        voiceIntroUrl: prof.voiceIntroUrl || null,
        profileCompletion: calculateProfileCompletion(prof),
        distance: distInfo.formatted,
        distanceKm: distInfo.distanceKm,
        isSameState: distInfo.isSameState,
        createdAt: u.createdAt,
        boostedUntil: prof.boostedUntil ? prof.boostedUntil.toISOString() : null,
        isBoosted: prof.boostedUntil ? new Date(prof.boostedUntil).getTime() > Date.now() : false,
      };
    });

    // Filter by age range
    mapped = mapped.filter((c) => c.age >= ageMin && c.age <= ageMax);

    // Filter by maximum distance if provided
    if ((filters as any).distanceMax) {
      const maxD = Number((filters as any).distanceMax);
      if (!isNaN(maxD)) {
        mapped = mapped.filter((c) => {
          const d = (c as any).distanceKm;
          return isNaN(d) || d <= maxD;
        });
      }
    }

    const nowTime = Date.now();
    const isProfileBoosted = (c: any) => {
      if (!c.boostedUntil) return false;
      return new Date(c.boostedUntil).getTime() > nowTime;
    };

    // Apply sorting
    if (sortBy === 'newest') {
      mapped.sort((a, b) => {
        const aBoost = isProfileBoosted(a) ? 1 : 0;
        const bBoost = isProfileBoosted(b) ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortBy === 'profileCompletion') {
      mapped.sort((a, b) => {
        const aBoost = isProfileBoosted(a) ? 1 : 0;
        const bBoost = isProfileBoosted(b) ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        return b.profileCompletion - a.profileCompletion;
      });
    } else if (sortBy === 'name') {
      mapped.sort((a, b) => {
        const aBoost = isProfileBoosted(a) ? 1 : 0;
        const bBoost = isProfileBoosted(b) ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        return a.name.localeCompare(b.name);
      });
    } else {
      // Default: 1. Active Spotlight Boosted -> 2. High Profile Completion (photos + voice + verification) -> 3. Newest
      mapped.sort((a, b) => {
        const aBoost = isProfileBoosted(a) ? 1 : 0;
        const bBoost = isProfileBoosted(b) ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        return b.profileCompletion - a.profileCompletion || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    // Apply Pagination
    const total = mapped.length;
    const pages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = mapped.slice(offset, offset + limit);

    return {
      profiles: paginated,
      pagination: {
        total,
        page,
        limit,
        pages,
      },
    };
  }

  /**
   * Send discover nudge notifications to users who have not viewed Discover
   * in the configured inactive period and haven't been nudged recently.
   * This is intended to be called by an external cron (Render cron) hitting
   * an internal endpoint. No external scheduler dependency required.
   */
  async sendDiscoverNudges(inactiveHours = 12, rateLimitHours = 24) {
    const now = new Date();
    const viewedThreshold = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);
    const nudgedThreshold = new Date(Date.now() - rateLimitHours * 60 * 60 * 1000);

    // Find users who are ACTIVE + APPROVED and whose settings indicate they
    // haven't viewed discover recently and haven't been nudged recently.
    const candidates = await prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      include: {
        settings: true,
      },
    });

    const eligibleCandidates = candidates.filter((u) => {
      const settings = u.settings;
      if (!settings) return false;

      const lastViewedAt = settings.lastDiscoverViewedAt;
      const lastNudgedAt = settings.lastDiscoverNudgedAt;

      return (!lastViewedAt || lastViewedAt < viewedThreshold) &&
        (!lastNudgedAt || lastNudgedAt < nudgedThreshold);
    });

    const created: any[] = [];

    for (const u of eligibleCandidates) {
      try {
        await prisma.$transaction(async (tx) => {
          const notif = await tx.notification.create({
            data: {
              userId: u.id,
              type: NotificationType.SYSTEM,
              title: 'New people near you',
              content: 'New people have joined near you — take a look.',
              relatedId: null,
            },
          });

          await tx.userSettings.update({
            where: { userId: u.id },
            data: { lastDiscoverNudgedAt: now },
          });

          created.push(notif);
        });

        // Emit real-time notification
        try {
          if (io) io.to(u.id).emit('notification', { notification: created[created.length - 1] });
        } catch (e) {
          // ignore socket failures
        }
      } catch (err) {
        // Per-user failures shouldn't block others
        continue;
      }
    }

    return { count: created.length };
  }
}
