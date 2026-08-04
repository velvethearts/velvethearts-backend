import { ProfileRepository } from '../repositories/profile.repository';
import { UserRepository } from '../repositories/user.repository';
import { MatchRepository } from '../repositories/match.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { prisma } from '../config/database';
import { calculateProfileCompletion } from './discover.service';

export interface ProfileInput {
  name: string;
  dobDay: number | string;
  dobMonth: number | string;
  dobYear: number | string;
  city: string;
  gender: string;
  showGender?: boolean;
  orientation: string;
  showOrientation?: boolean;
  relationshipIntent: string;
  relationshipStatus: string;
  interests: string[];
  story: string;
  hasDisability?: boolean;
  disabilityInfo?: string;
  showDisability?: boolean;
  photos: string[];
  languages?: string[];
  education?: string;
  occupation?: string;
}

export class ProfileService {
  private profileRepository = new ProfileRepository();
  private userRepository = new UserRepository();
  private matchRepository = new MatchRepository();
  private logRepository = new ActivityLogRepository();

  async getProfile(userId: string) {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) return null;

    const dobDate = new Date(profile.dob);
    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      dobDay: dobDate.getDate(),
      dobMonth: dobDate.getMonth() + 1,
      dobYear: dobDate.getFullYear(),
      city: profile.city,
      gender: profile.gender,
      showGender: profile.showGender,
      orientation: profile.orientation,
      showOrientation: profile.showOrientation,
      relationshipIntent: profile.relationshipIntent,
      relationshipStatus: profile.relationshipStatus,
      interests: profile.interests,
      languages: profile.languages || [],
      education: profile.education || '',
      occupation: profile.occupation || '',
      story: profile.story,
      hasDisability: profile.hasDisability,
      disabilityInfo: profile.disabilityInfo,
      showDisability: profile.showDisability,
      verified: profile.verified,
      isPremium: profile.isPremium,
      photos: profile.photos.map((p) => p.secureUrl),
      profileCompletion: calculateProfileCompletion(profile),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async saveProfile(userId: string, data: ProfileInput) {
    const d = parseInt(String(data.dobDay), 10);
    const m = parseInt(String(data.dobMonth), 10);
    const y = parseInt(String(data.dobYear), 10);
    const dob = new Date(y, m - 1, d);

    await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.upsert({
        where: { userId },
        update: {
          name: data.name,
          dob,
          city: data.city,
          gender: data.gender,
          showGender: data.showGender ?? true,
          orientation: data.orientation,
          showOrientation: data.showOrientation ?? true,
          relationshipIntent: data.relationshipIntent,
          relationshipStatus: data.relationshipStatus,
          story: data.story,
          hasDisability: data.hasDisability ?? false,
          disabilityInfo: data.disabilityInfo,
          showDisability: data.showDisability ?? false,
          interests: data.interests,
          languages: data.languages || [],
          education: data.education || null,
          occupation: data.occupation || null,
        },
        create: {
          userId,
          name: data.name,
          dob,
          city: data.city,
          gender: data.gender,
          showGender: data.showGender ?? true,
          orientation: data.orientation,
          showOrientation: data.showOrientation ?? true,
          relationshipIntent: data.relationshipIntent,
          relationshipStatus: data.relationshipStatus,
          story: data.story,
          hasDisability: data.hasDisability ?? false,
          disabilityInfo: data.disabilityInfo,
          showDisability: data.showDisability ?? false,
          interests: data.interests,
          languages: data.languages || [],
          education: data.education || null,
          occupation: data.occupation || null,
        },
      });

      await tx.photo.deleteMany({
        where: { profileId: profile.id },
      });

      if (data.photos && data.photos.length > 0) {
        await tx.photo.createMany({
          data: data.photos.map((url, index) => ({
            profileId: profile.id,
            cloudinaryPublicId: `profile_photo_${profile.id}_${index}`,
            secureUrl: url,
            photoOrder: index,
            isPrimary: index === 0,
          })),
        });
      }

      return profile;
    });

    await this.logRepository.create({
      userId,
      action: 'PROFILE_UPDATE',
      details: JSON.stringify({ name: data.name }),
    });

    return this.getProfile(userId);
  }

  async softDeleteAccount(userId: string, ipAddress?: string, userAgent?: string) {
    const user = await this.userRepository.findById(userId);
    if (!user || user.status === 'DELETED') {
      throw new Error('User not found or already deleted');
    }
    const activeMatches = await this.matchRepository.findActiveMatchesByUser(userId);
    for (const match of activeMatches) {
      await this.matchRepository.unmatch(match.id, userId);
    }

    await this.logRepository.create({
      userId,
      action: 'ACCOUNT_DELETION',
      ipAddress,
      userAgent,
    });

    await this.userRepository.delete(userId);

    return { success: true };
  }

  async getSettings(userId: string) {
    let settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          matchNotifs: true,
          chatNotifs: true,
          interestNotifs: true,
          emailNotifs: false,
          theme: 'system',
          reduceMotion: false,
          highContrast: false,
          textSize: 'medium',
        },
      });
    }
    return settings;
  }

  async updateSettings(userId: string, data: any) {
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(typeof data.matchNotifs === 'boolean' && { matchNotifs: data.matchNotifs }),
        ...(typeof data.chatNotifs === 'boolean' && { chatNotifs: data.chatNotifs }),
        ...(typeof data.interestNotifs === 'boolean' && { interestNotifs: data.interestNotifs }),
        ...(typeof data.emailNotifs === 'boolean' && { emailNotifs: data.emailNotifs }),
        ...(typeof data.theme === 'string' && { theme: data.theme }),
        ...(typeof data.reduceMotion === 'boolean' && { reduceMotion: data.reduceMotion }),
        ...(typeof data.highContrast === 'boolean' && { highContrast: data.highContrast }),
        ...(typeof data.textSize === 'string' && { textSize: data.textSize }),
      },
      create: {
        userId,
        matchNotifs: data.matchNotifs ?? true,
        chatNotifs: data.chatNotifs ?? true,
        interestNotifs: data.interestNotifs ?? true,
        emailNotifs: data.emailNotifs ?? false,
        theme: data.theme || 'system',
        reduceMotion: data.reduceMotion ?? false,
        highContrast: data.highContrast ?? false,
        textSize: data.textSize || 'medium',
      },
    });
    return settings;
  }
}
