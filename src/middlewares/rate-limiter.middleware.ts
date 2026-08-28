import rateLimit from 'express-rate-limit';

// Key generator that uses authenticated userId when available, falling back to client IP
const userOrIpKey = (req: any) => req.user?.userId || req.user?.id || req.ip;

/**
 * 1. Global Baseline Limiter
 * Applied to all /api/v1 endpoints as a safety net against DoS and crawling floods.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Rate limit exceeded. Please pace your requests.',
  },
});

/**
 * 2. Authentication & Login Limiter
 * Strict protection against credential stuffing, token brute-forcing, and unauthorized session minting.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Max 15 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

/**
 * 3. Biometric Photo Verification Limiter
 * Protects compute-heavy face landmarking and Cloudinary operations.
 */
export const photoVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // Max 8 attempts per 15 min per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many face verification attempts. Please wait a few minutes before retrying.',
  },
});

/**
 * 4. Profile Mutation Limiter
 * Prevents DB write thrashing and rapid profile state manipulation.
 */
export const profileMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many profile update requests. Please wait a moment.',
  },
});

/**
 * 5. Account Deletion Limiter
 * Guards against rapid account creation/deletion abuse.
 */
export const accountDeleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Account deletion rate limit reached. Please try again later.',
  },
});

/**
 * 6. Matching & Swiping Limiter
 * Rate limits likes, unlikes, and unmatches to enforce intentionality and block bot swiping.
 */
export const likeRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many like/match actions. Please wait a moment.',
  },
});

/**
 * 7. Chat & Messaging Limiter
 * Protects chat messaging, diary messages, notes, and editing.
 */
export const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many messages sent. Please pace your conversation.',
  },
});

/**
 * 8. Safety & Reporting Limiter
 * Prevents report spam while keeping reporting accessible.
 */
export const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Report submission rate limit reached. Please contact support if you need urgent assistance.',
  },
});

/**
 * 9. Block & Unblock Limiter
 * Prevents script-based toggling of block/unblock states.
 */
export const blockRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many block/unblock actions. Please wait a moment.',
  },
});

/**
 * 10. Search & Discover Recommendations Limiter
 * Protects database search queries and recommendation algorithms.
 */
export const searchDiscoverRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many search queries. Please pace your requests.',
  },
});

/**
 * 11. Media Upload Limiter
 * Prevents Cloudinary quota drainage and large payload floods.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many upload requests. Please wait a moment before uploading again.',
  },
});

/**
 * 12. Rewind Letters (Wax-Sealed Love Letters) Limiter
 * Protects scheduled message delivery and email dispatch triggers.
 */
export const rewindLetterLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many letter operations. Please wait a moment.',
  },
});

/**
 * 13. Web Push Subscription Limiter
 * Guards push notification endpoints against flood registrations.
 */
export const pushRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Push subscription rate limit reached. Please try again later.',
  },
});

/**
 * 14. Admin Privilege Operations Limiter
 * Strictly rate-limits super admin creation and admin revocations.
 */
export const adminPrivilegeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Admin privilege rate limit exceeded. Please wait before performing further admin modifications.',
  },
});

/**
 * 15. Admin Management Actions Limiter
 * Protects admin moderation actions (approve, reject, suspend, restore, reports).
 */
export const adminActionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many administrative requests. Please pace your actions.',
  },
});

/**
 * 16. Fallback REST Typing & Seen Receipts Limiter
 * Protects HTTP typing indicator and seen receipts against polling floods.
 */
export const typingRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Too many typing/read updates. Please wait a moment.',
  },
});
