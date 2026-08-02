import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from './env';

const getFirebaseApp = (): App => {
  const apps = getApps();

  if (apps.length > 0) {
    const current = apps[0];
    if (!current) {
      throw new Error('Firebase Admin SDK is unavailable');
    }
    return current;
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
    throw new Error('Firebase Admin SDK credentials are not configured');
  }

  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    }),
  });
};

export const firebaseAuth = (): Auth => {
  return getAuth(getFirebaseApp());
};
