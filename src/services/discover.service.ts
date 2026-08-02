import { prisma } from '../config/database';
import { BlockRepository } from '../repositories/block.repository';
import { LikeRepository } from '../repositories/like.repository';
import { UserStatus, ApprovalStatus } from '@prisma/client';

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
  
  if (profile.photos && profile.photos.length > 0) score += 20;
  if (profile.story && profile.story.length >= 20) score += 20;
  if (profile.promptAnswers && profile.promptAnswers.length > 0) score += 15;
  if (profile.interests && profile.interests.length >= 3) score += 10;
  if (profile.city && profile.city.length >= 2) score += 10;
  if (profile.gender && profile.orientation) score += 10;
  if (profile.dob) score += 10;
  if (profile.relationshipIntent) score += 5;
  
  return score;
}

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

    // Exclude blocked users (both ways)
    const blockedIds = await this.blockRepository.findBlockedUserIds(userId);
    blockedIds.forEach((id) => excludeIds.add(id));

    // Exclude users already liked by this user
    const sentLikes = await this.likeRepository.findSentLikesByUser(userId);
    sentLikes.forEach((like) => excludeIds.add(like.receiverId));

    // Exclude users currently matched with this user (both active and unmatched)
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
        unmatched: false,
      },
    });
    matches.forEach((m) => {
      excludeIds.add(m.user1Id);
      excludeIds.add(m.user2Id);
    });

    // Exclude reported users (both ways)
    const reports = await prisma.report.findMany({
      where: {
        OR: [
          { reporterId: userId },
          { reportedId: userId }
        ]
      }
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
      approvalStatus: ApprovalStatus.APPROVED,
      profile: {
        isNot: null,
      },
    };

    const profileFilters: any = {};

    if (filters.gender && filters.gender !== 'All') {
      profileFilters.gender = {
        equals: filters.gender,
        mode: 'insensitive',
      };
    }

    if (filters.relationshipIntent && filters.relationshipIntent !== 'All') {
      profileFilters.relationshipIntent = {
        equals: filters.relationshipIntent,
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

    if (Object.keys(profileFilters).length > 0) {
      whereClause.profile = {
        ...whereClause.profile,
        ...profileFilters,
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

      // Generate a static/random distance placeholder
      const randDist = (Math.random() * 15 + 1.2).toFixed(1);

      return {
        id: u.id,
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
        verified: u.approvalStatus === ApprovalStatus.APPROVED,
        isPremium: prof.isPremium,
        photos: prof.photos.map((p) => p.secureUrl),
        profileCompletion: calculateProfileCompletion(prof),
        distance: `${randDist} km`,
        createdAt: u.createdAt,
      };
    });

    // Filter by age range
    const ageMin = filters.ageMin ?? 18;
    const ageMax = filters.ageMax ?? 100;
    mapped = mapped.filter((c) => c.age >= ageMin && c.age <= ageMax);

    // Apply sorting
    if (sortBy === 'newest') {
      mapped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (sortBy === 'profileCompletion') {
      mapped.sort((a, b) => b.profileCompletion - a.profileCompletion);
    } else if (sortBy === 'name') {
      mapped.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Default: mix of newest and complete profiles
      mapped.sort((a, b) => b.profileCompletion - a.profileCompletion || b.createdAt.getTime() - a.createdAt.getTime());
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
}
