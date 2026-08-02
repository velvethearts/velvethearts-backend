import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { UserRepository } from '../repositories/user.repository';
import { prisma } from '../config/database';
import { firebaseAuth } from '../config/firebase';
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

  private async verifyFirebaseIdToken(firebaseIdToken: string): Promise<FirebaseUserInfo> {
    const decoded = await firebaseAuth().verifyIdToken(firebaseIdToken);

    return {
      uid: decoded.uid,
      email: decoded.email?.trim(),
      name: decoded.name,
      picture: decoded.picture,
      phoneNumber: decoded.phone_number?.trim(),
    };
  }

  async authenticateFirebaseUser(
    firebaseIdToken: string,
    options: { phoneNumber?: string; ipAddress?: string; userAgent?: string } = {}
  ): Promise<User> {
    const firebaseUser = await this.verifyFirebaseIdToken(firebaseIdToken);
    const phoneNumber = options.phoneNumber?.trim() || firebaseUser.phoneNumber;

    let user = await this.userRepository.findByFirebaseUid(firebaseUser.uid);

  if (user && user.status !== UserStatus.DELETED) {
    const updates: { email?: string; phoneNumber?: string } = {};

  if (firebaseUser.email && user.email !== firebaseUser.email) {
    updates.email = firebaseUser.email;
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
      email: user.email,
      phoneNumber: user.phoneNumber,
      provider: 'FIREBASE',
    }),
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  });

  return user;
}

    // Either no user exists for this Firebase identity yet, or the only
    // matching row was soft-deleted — either way we need a fresh account.
    const deletedUserForFirebaseUid = user; // may be null, or the DELETED row holding this firebaseUid

    const lastDeleted =
      deletedUserForFirebaseUid ??
      (await prisma.user.findFirst({
        where: {
          phoneNumber: phoneNumber || '',
          status: UserStatus.DELETED,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }));

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
          email: firebaseUser.email,
          role: Role.USER,
          approvalStatus: ApprovalStatus.APPROVED,
          status: UserStatus.ACTIVE,
          previousUserId: lastDeleted ? lastDeleted.id : null,
          phoneVerified: !!firebaseUser.phoneNumber,
          phoneVerifiedAt: firebaseUser.phoneNumber ? new Date() : null,
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

    return user;
  }
}