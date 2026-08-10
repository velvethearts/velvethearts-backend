import webpush from 'web-push';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// Default development VAPID keys fallback if env vars are unset
const defaultVapid = webpush.generateVAPIDKeys();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || defaultVapid.publicKey;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || defaultVapid.privateKey;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@velvethearts.app';

try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} catch (err) {
  logger.error('Failed to set VAPID details for Web Push:', err);
}

export class PushService {
  getVapidPublicKey(): string {
    return vapidPublicKey;
  }

  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription payload');
    }

    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async unsubscribe(endpoint: string) {
    try {
      await prisma.pushSubscription.delete({ where: { endpoint } });
    } catch (_) {
      // Ignore if not found
    }
  }

  async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; icon?: string; url?: string; data?: any }
  ) {
    const rawSubscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    // Deduplicate by endpoint to prevent sending duplicate push notifications to the same device
    const seenEndpoints = new Set<string>();
    const subscriptions = rawSubscriptions.filter((sub) => {
      if (!sub.endpoint || seenEndpoints.has(sub.endpoint)) return false;
      seenEndpoints.add(sub.endpoint);
      return true;
    });

    if (subscriptions.length === 0) {
      logger.info(`No active PushSubscriptions found for target userId: ${userId}`);
      return;
    }

    logger.info(`Sending Web Push notification to ${subscriptions.length} subscription(s) for userId: ${userId}`);

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/velvet-heart-logo.png',
      badge: '/velvet-heart-logo.png',
      data: {
        url: payload.url || '/notifications',
        timestamp: Date.now(),
        ...payload.data,
      },
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, pushPayload);
        logger.info(`✅ Web Push notification delivered to endpoint: ${sub.endpoint.slice(0, 45)}...`);
      } catch (error: any) {
        logger.warn(`❌ Push notification failed for endpoint ${sub.endpoint.slice(0, 45)}...:`, error?.statusCode || error?.message);
        // Clean up expired or invalid subscriptions (404 Not Found or 410 Gone)
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await this.unsubscribe(sub.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);
  }
}
