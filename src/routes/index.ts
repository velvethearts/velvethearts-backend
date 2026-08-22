import { Router } from 'express';
import multer from 'multer';

// Controllers
import { AuthController } from '../controllers/auth.controller';
import { ProfileController } from '../controllers/profile.controller';
import { DiscoverController } from '../controllers/discover.controller';
import { MatchController } from '../controllers/match.controller';
import { ChatController } from '../controllers/chat.controller';
import { SafetyController } from '../controllers/safety.controller';
import { AdminController } from '../controllers/admin.controller';
import { UploadController } from '../controllers/upload.controller';
import { SearchController } from '../controllers/search.controller';
import { NotificationController } from '../controllers/notification.controller';
import { PushController } from '../controllers/push.controller';
import { RewindLetterController } from '../controllers/rewind-letter.controller';

// Middlewares
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { 
  authRateLimiter, 
  likeRateLimiter, 
  chatRateLimiter, 
  reportRateLimiter, 
  searchDiscoverRateLimiter,
  uploadRateLimiter,
} from '../middlewares/rate-limiter.middleware';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

const authCtrl = new AuthController();
const profileCtrl = new ProfileController();
const discoverCtrl = new DiscoverController();
const searchCtrl = new SearchController();
const matchCtrl = new MatchController();
const chatCtrl = new ChatController();
const safetyCtrl = new SafetyController();
const adminCtrl = new AdminController();
const uploadCtrl = new UploadController();
const notifCtrl = new NotificationController();
const pushCtrl = new PushController();
const rewindLetterCtrl = new RewindLetterController();

// ==========================================
// AUTH ROUTES
// ==========================================
router.post('/auth/login', authRateLimiter, authCtrl.login);

// ==========================================
// PROFILE ROUTES
// ==========================================
// Pending users are allowed to retrieve their profile to check approvalStatus
router.get('/profile/me', requireAuth, profileCtrl.getMe);
router.get('/profile/settings', requireAuth, profileCtrl.getSettings);
router.put('/profile/settings', requireAuth, profileCtrl.updateSettings);
router.post('/profile', requireAuth, profileCtrl.saveProfile);
router.delete('/profile', requireAuth, profileCtrl.deleteAccount);

// ==========================================
// DISCOVER & SEARCH ROUTES
// ==========================================
router.get('/discover', requireAuth,  searchDiscoverRateLimiter, discoverCtrl.getRecommendations);

// Internal cron endpoint for discover nudges (protected by x-cron-secret header)
router.post('/internal/cron/discover-nudge', discoverCtrl.runDiscoverNudge);
router.get('/search', requireAuth,  searchDiscoverRateLimiter, searchCtrl.search);

// ==========================================
// MATCH ROUTES
// ==========================================
router.post('/match/like', requireAuth,  likeRateLimiter, matchCtrl.like);
router.post('/match/unlike', requireAuth, likeRateLimiter, matchCtrl.unlike);
router.post('/match/unmatch', requireAuth,  matchCtrl.unmatch);
router.get('/match/connections', requireAuth,  matchCtrl.getConnections);
router.get('/match/received-invites', requireAuth, matchCtrl.getReceivedInvites);
router.get('/match/sent-invites', requireAuth, matchCtrl.getSentInvites);

// ==========================================
// REWIND LETTER ROUTES
// ==========================================
router.post('/rewind-letter', requireAuth, rewindLetterCtrl.write);
router.get('/rewind-letter/:matchId/status', requireAuth, rewindLetterCtrl.getStatus);
router.get('/rewind-letter/:matchId/content', requireAuth, rewindLetterCtrl.getDelivered);

// ==========================================
// SAFETY ROUTES (BLOCK & REPORT)
// ==========================================
router.post('/block', requireAuth, safetyCtrl.block);
router.delete('/block/:blockedUserId', requireAuth, safetyCtrl.unblock);
router.post('/unblock', requireAuth, safetyCtrl.unblock);
router.get('/safety/blocked', requireAuth, safetyCtrl.getBlockedUsers);
router.post('/safety/reports', requireAuth, reportRateLimiter, safetyCtrl.report);

// ==========================================
// CHAT & MESSAGING ROUTES
// ==========================================
router.get('/chat/conversations', requireAuth,  chatCtrl.getConversations);
router.get('/chat/conversations/:conversationId/messages', requireAuth, chatCtrl.getMessages);
router.post('/chat/conversations/:conversationId/messages', requireAuth,  chatRateLimiter, chatCtrl.sendMessage);
router.delete('/chat/conversations/:conversationId/messages', requireAuth, chatCtrl.deleteConversationMessages);
router.put('/chat/messages/:messageId', requireAuth, chatRateLimiter, chatCtrl.editMessage);
router.delete('/chat/messages/:messageId', requireAuth, chatCtrl.deleteMessage);
router.post('/chat/conversations/:conversationId/seen', requireAuth, chatCtrl.markSeen);
router.post('/chat/conversations/:conversationId/delivered', requireAuth, chatCtrl.markDelivered);
router.post('/chat/conversations/:conversationId/typing', requireAuth, chatCtrl.postTyping);
router.get('/chat/conversations/:conversationId/typing', requireAuth, chatCtrl.getTyping);

// ==========================================
// UPLOAD ROUTE
// ==========================================
router.post('/upload', requireAuth, uploadRateLimiter, upload.any(), uploadCtrl.uploadPhoto);

// ==========================================
// NOTIFICATION & PUSH ROUTES
// ==========================================
router.get('/notifications', requireAuth, notifCtrl.getNotifications);
router.post('/notifications/:id/read', requireAuth, notifCtrl.markRead);
router.post('/notifications/read-all', requireAuth, notifCtrl.markAllRead);
router.delete('/notifications/:id', requireAuth, notifCtrl.deleteNotification);

// Web Push API
router.get('/push/vapid-public-key', pushCtrl.getVapidPublicKey);
router.post('/push/subscribe', requireAuth, pushCtrl.subscribe);
router.post('/push/unsubscribe', requireAuth, pushCtrl.unsubscribe);

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================
router.get('/admin/stats', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.getDashboardStats);
router.get('/admin/users', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.getUsers);
router.post('/admin/users/:userId/suspend', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.suspendUser);
router.post('/admin/users/:userId/restore', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.restoreUser);
router.get('/admin/users/pending', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.getPendingQueue);
router.post('/admin/users/:userId/approve', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.approve);
router.post('/admin/users/:userId/reject', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.reject);
router.get('/admin/users/history', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.getPhoneHistory);
router.get('/admin/reports', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.getReports);
router.post('/admin/reports/:reportId/close', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.closeReport);
router.get('/admin/logs', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminCtrl.getAuditLogs);

// SUPER ADMIN ONLY OPERATIONS
router.post('/admin/create', requireAuth, requireRole(['SUPER_ADMIN']), adminCtrl.createAdmin);
router.post('/admin/remove', requireAuth, requireRole(['SUPER_ADMIN']), adminCtrl.removeAdmin);

export default router;
