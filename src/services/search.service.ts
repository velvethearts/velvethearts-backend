import { prisma } from '../config/database';
import { BlockRepository } from '../repositories/block.repository';
import { LikeRepository } from '../repositories/like.repository';
import { UserStatus, ApprovalStatus } from '@prisma/client';
import { calculateProfileCompletion } from './discover.service';

export interface SearchFilters {
  name?: string;
  city?: string;
  interest?: string;
  occupation?: string;
  education?: string;
  gender?: string;
}

export class SearchService {
  private blockRepository = new BlockRepository();
  private likeRepository = new LikeRepository();

  async searchProfiles(
    userId: string, 
    filters: SearchFilters, 
    page = 1, 
    limit = 20
  ) {
    const excludeIds = new Set<string>();
    excludeIds.add(userId);

    // Blocked exclusions
    const blockedIds = await this.blockRepository.findBlockedUserIds(userId);
    blockedIds.forEach((id) => excludeIds.add(id));

    // Liked exclusions
    const sentLikes = await this.likeRepository.findSentLikesByUser(userId);
    sentLikes.forEach((like) => excludeIds.add(like.receiverId));

    // Matched exclusions
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

    // Reported exclusions
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

    // Construct search where clauses
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

    if (filters.name) {
      profileFilters.name = {
        contains: filters.name.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.city) {
      profileFilters.city = {
        contains: filters.city.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.occupation) {
      profileFilters.occupation = {
        contains: filters.occupation.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.education) {
      profileFilters.education = {
        contains: filters.education.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.gender) {
      profileFilters.gender = {
        equals: filters.gender,
        mode: 'insensitive',
      };
    }

    if (filters.interest) {
      profileFilters.interests = {
        has: filters.interest.trim(),
      };
    }

    if (Object.keys(profileFilters).length > 0) {
      whereClause.profile = {
        ...whereClause.profile,
        ...profileFilters,
      };
    }

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

    const mapped = candidates.map((u) => {
      const prof = u.profile!;
      const today = new Date();
      const dobDate = new Date(prof.dob);
      let age = today.getFullYear() - dobDate.getFullYear();
      const mDiff = today.getMonth() - dobDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

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
