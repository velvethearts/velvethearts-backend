import { prisma } from '../config/database';
import { Profile, Photo, PromptAnswer, Prisma } from '@prisma/client';

export class ProfileRepository {
  async findByUserId(userId: string): Promise<(Profile & { photos: Photo[]; promptAnswers: PromptAnswer[] }) | null> {
    return prisma.profile.findUnique({
      where: { userId },
      include: {
        photos: {
          orderBy: {
            photoOrder: 'asc',
          },
        },
        promptAnswers: true,
      },
    });
  }

  async upsert(userId: string, data: Omit<Prisma.ProfileCreateInput, 'user'>): Promise<Profile> {
    return prisma.profile.upsert({
      where: { userId },
      update: {
        name: data.name,
        dob: data.dob,
        city: data.city,
        gender: data.gender,
        showGender: data.showGender,
        orientation: data.orientation,
        showOrientation: data.showOrientation,
        relationshipIntent: data.relationshipIntent,
        relationshipStatus: data.relationshipStatus,
        story: data.story,
        hasDisability: data.hasDisability,
        disabilityInfo: data.disabilityInfo,
        showDisability: data.showDisability,
      },
      create: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  }

  async createPhoto(profileId: string, photoData: { cloudinaryPublicId: string; secureUrl: string; width?: number; height?: number; isPrimary?: boolean; photoOrder?: number }): Promise<Photo> {
    return prisma.photo.create({
      data: {
        profileId,
        cloudinaryPublicId: photoData.cloudinaryPublicId,
        secureUrl: photoData.secureUrl,
        width: photoData.width,
        height: photoData.height,
        isPrimary: photoData.isPrimary || false,
        photoOrder: photoData.photoOrder || 0,
      },
    });
  }

  async deletePhoto(photoId: string): Promise<Photo> {
    return prisma.photo.delete({
      where: { id: photoId },
    });
  }

  async clearPhotos(profileId: string): Promise<Prisma.BatchPayload> {
    return prisma.photo.deleteMany({
      where: { profileId },
    });
  }

  async savePromptAnswers(profileId: string, answers: { promptQuestion: string; answer: string }[]): Promise<void> {
    // Delete existing
    await prisma.promptAnswer.deleteMany({
      where: { profileId },
    });
    // Create new
    if (answers.length > 0) {
      await prisma.promptAnswer.createMany({
        data: answers.map((ans) => ({
          profileId,
          promptQuestion: ans.promptQuestion,
          answer: ans.answer,
        })),
      });
    }
  }
}
