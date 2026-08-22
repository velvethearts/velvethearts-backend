import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { UserRepository } from '../repositories/user.repository';
import { EmailService } from './email.service';
import { prisma } from '../config/database';
import { firebaseAuth } from '../config/firebase';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApprovalStatus, Role, User, UserStatus } from '@prisma/client';

interface FirebaseUserInfo {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  phoneNumber?: string;
}

export class AuthService {
  private userRepository = new UserRepository();
  private logRepository = new ActivityLogRepository();
  private emailService = new EmailService();


  private async verifyFirebaseIdToken(firebaseIdToken: string): Promise<FirebaseUserInfo> {
    if (firebaseIdToken.startsWith('dev-google:')) {
      if (env.NODE_ENV === 'production' || !env.ENABLE_DEV_AUTH) {
        throw new Error('Development authentication is disabled');
      }
      const email = firebaseIdToken.replace('dev-google:', '').trim();
      if (!email) {
        throw new Error('Invalid development authentication token');
      }
      return {
        uid: `dev_uid_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: email,
        name: 'Dev User',
      };
    }

    const decoded = await firebaseAuth().verifyIdToken(firebaseIdToken);
    return {
      uid: decoded.uid,
      email: decoded.email?.trim(),
      name: decoded.name,
      picture: decoded.picture,
      phoneNumber: decoded.phone_number?.trim(),
    };
  }

  private async sendWelcomeEmailSafely(userId: string, email: string, name?: string, isReturningUser: boolean = false): Promise<void> {
    try {
      const sent = await this.emailService.sendWelcomeEmail(email, name, isReturningUser);
      if (sent) {
        await prisma.user.update({
          where: { id: userId },
          data: { welcomeEmailSent: true },
        });
        logger.info(`[AuthService] ${isReturningUser ? 'Welcome back' : 'Welcome'} email successfully sent and recorded for user ${userId}`);
      }
    } catch (err: any) {
      logger.error(`[AuthService] Error attempting ${isReturningUser ? 'welcome back' : 'welcome'} email for user ${userId}:`, err?.message || err);
    }
  }

  async authenticateFirebaseUser(
    firebaseIdToken: string,
    options: { phoneNumber?: string; ipAddress?: string; userAgent?: string } = {}
  ): Promise<User> {
    const firebaseUser = await this.verifyFirebaseIdToken(firebaseIdToken);
    const phoneNumber = options.phoneNumber?.trim() || firebaseUser.phoneNumber;

    let user = await this.userRepository.findByFirebaseUid(firebaseUser.uid);

    if (!user && firebaseUser.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: firebaseUser.email,
          status: { not: UserStatus.DELETED },
        },
        include: { profile: true },
      });
      if (existingUser) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firebaseUid: firebaseUser.uid,
            name: existingUser.name || firebaseUser.name || null,
          },
          include: { profile: true },
        });
      }
    }

    if (user && user.status !== UserStatus.DELETED) {
      const updates: { email?: string; phoneNumber?: string; name?: string } = {};

      if (firebaseUser.email && user.email !== firebaseUser.email) {
        updates.email = firebaseUser.email;
      }

      // Only populate name from Firebase if the user has no name set yet (never overwrite custom profile name)
      if (firebaseUser.name && !user.name) {
        updates.name = firebaseUser.name;
      }

      if (phoneNumber && user.phoneNumber !== phoneNumber) {
        updates.phoneNumber = phoneNumber;
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }

      await this.logRepository.create({
        userId: user.id,
        action: 'USER_LOGIN',
        details: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          provider: 'FIREBASE',
        }),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      });

      if (!user.welcomeEmailSent) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { welcomeEmailSent: true },
        });
      }

      return user;
    }

    // Either no user exists for this Firebase identity yet, or the only
    // matching row was soft-deleted — either way we need a fresh account.
    const deletedUserForFirebaseUid = user; // may be null, or the DELETED row holding this firebaseUid

    const lastDeleted =
      deletedUserForFirebaseUid ??
      (await prisma.user.findFirst({
        where: {
          OR: [
            { phoneNumber: phoneNumber || undefined },
            { email: firebaseUser.email || undefined },
          ],
          status: UserStatus.DELETED,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }));

    const isReturningUser = Boolean(deletedUserForFirebaseUid || lastDeleted);

    user = await prisma.$transaction(async (tx) => {
      // The old deleted row may still hold this firebaseUid (it's a unique
      // column), so free it up first or the create below will conflict.
      if (deletedUserForFirebaseUid) {
        await tx.user.update({
          where: { id: deletedUserForFirebaseUid.id },
          data: { firebaseUid: null },
        });
      }

      const newUser = await tx.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          phoneNumber: phoneNumber || '',
          name: firebaseUser.name || null,
          email: firebaseUser.email,
          role: Role.USER,
          approvalStatus: ApprovalStatus.APPROVED,
          status: UserStatus.ACTIVE,
          previousUserId: lastDeleted ? lastDeleted.id : null,
          phoneVerified: !!firebaseUser.phoneNumber,
          phoneVerifiedAt: firebaseUser.phoneNumber ? new Date() : null,
          welcomeEmailSent: false,
        },
      });

      await tx.userSettings.create({
        data: {
          userId: newUser.id,
          theme: 'system',
          textSize: 'medium',
        },
      });

      return newUser;
    });

    await this.logRepository.create({
      userId: user.id,
      action: 'USER_REGISTER',
      details: JSON.stringify({
        firebaseUid: firebaseUser.uid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        name: firebaseUser.name,
        picture: firebaseUser.picture,
        provider: 'FIREBASE',
      }),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    if (user.email && !user.welcomeEmailSent) {
      this.sendWelcomeEmailSafely(user.id, user.email, firebaseUser.name, isReturningUser);
    }

    return user;
  }
}