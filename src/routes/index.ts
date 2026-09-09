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
import { DiaryController } from '../controllers/diary.controller';
import { WarningController } from '../controllers/warning.controller';

// Middlewares
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { 
  authRateLimiter, 
  photoVerifyRateLimiter,
  profileMutationLimiter,
  accountDeleteLimiter,
  likeRateLimiter, 
  chatRateLimiter, 
  reportRateLimiter, 
  blockRateLimiter,
  searchDiscoverRateLimiter,
  uploadRateLimiter,
  rewindLetterLimiter,
  pushRateLimiter,
  adminPrivilegeLimiter,
  adminActionLimiter,
  typingRateLimiter,
} from '../middlewares/rate-limiter.middleware';

const router = Router();
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit for 1-2 min HD/4K videos and photos

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
const diaryCtrl = new DiaryController();
const warningCtrl = new WarningController();

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
router.put('/profile/settings', requireAuth, profileMutationLimiter, profileCtrl.updateSettings);
router.post('/profile', requireAuth, profileMutationLimiter, profileCtrl.saveProfile);
router.post('/profile/verify-photo', requireAuth, photoVerifyRateLimiter, profileCtrl.verifyPhoto);
router.post('/profile/verify-manual', requireAuth, photoVerifyRateLimiter, profileCtrl.submitManualVerification);
router.get('/profile/verification-status', requireAuth, searchDiscoverRateLimiter, profileCtrl.getVerificationStatus);
router.post('/profile/boost', requireAuth, profileMutationLimiter, profileCtrl.activateBoost);
router.get('/profile/boost-status', requireAuth, searchDiscoverRateLimiter, profileCtrl.getBoostStatus);
router.delete('/profile', requireAuth, accountDeleteLimiter, profileCtrl.deleteAccount);

// ==========================================
// DISCOVER & SEARCH ROUTES
// ==========================================
router.get('/discover', requireAuth, searchDiscoverRateLimiter, discoverCtrl.getRecommendations);

// Internal cron endpoint for discover nudges (protected by x-cron-secret header)
router.post('/internal/cron/discover-nudge', searchDiscoverRateLimiter, discoverCtrl.runDiscoverNudge);
router.get('/search', requireAuth, searchDiscoverRateLimiter, searchCtrl.search);

// ==========================================
// MATCH ROUTES
// ==========================================
router.post('/match/like', requireAuth, likeRateLimiter, matchCtrl.like);
router.post('/match/unlike', requireAuth, likeRateLimiter, matchCtrl.unlike);
router.post('/match/unmatch', requireAuth, likeRateLimiter, matchCtrl.unmatch);
router.get('/match/connections', requireAuth, matchCtrl.getConnections);
router.get('/match/received-invites', requireAuth, matchCtrl.getReceivedInvites);
router.get('/match/sent-invites', requireAuth, matchCtrl.getSentInvites);
router.get('/match/super-sparks-quota', requireAuth, searchDiscoverRateLimiter, matchCtrl.getSuperSparksQuota);

// ==========================================
// REWIND LETTER ROUTES
// ==========================================
router.post('/rewind-letter', requireAuth, rewindLetterLimiter, rewindLetterCtrl.write);
router.put('/rewind-letter/:matchId', requireAuth, rewindLetterLimiter, rewindLetterCtrl.edit);
router.delete('/rewind-letter/:matchId', requireAuth, rewindLetterLimiter, rewindLetterCtrl.delete);
router.patch('/rewind-letter/:matchId/schedule', requireAuth, rewindLetterLimiter, rewindLetterCtrl.updateSchedule);
router.get('/rewind-letter/:matchId/status', requireAuth, rewindLetterCtrl.getStatus);
router.get('/rewind-letter/:matchId/content', requireAuth, rewindLetterCtrl.getDelivered);

// ==========================================
// OUR DIARY ROUTES
// ==========================================
router.get('/diary/:matchId', requireAuth, chatRateLimiter, diaryCtrl.getEntries);
router.post('/diary/:matchId/message', requireAuth, chatRateLimiter, diaryCtrl.saveMessage);
router.post('/diary/:matchId/note', requireAuth, chatRateLimiter, diaryCtrl.addNote);
router.post('/diary/:matchId/photo', requireAuth, uploadRateLimiter, upload.single('photo'), diaryCtrl.uploadPhoto);
router.delete('/diary/:matchId/:entryId', requireAuth, chatRateLimiter, diaryCtrl.deleteEntry);

// ==========================================
// SAFETY ROUTES (BLOCK & REPORT)
// ==========================================
router.post('/block', requireAuth, blockRateLimiter, safetyCtrl.block);
router.delete('/block/:blockedUserId', requireAuth, blockRateLimiter, safetyCtrl.unblock);
router.post('/unblock', requireAuth, blockRateLimiter, safetyCtrl.unblock);
router.get('/safety/blocked', requireAuth, safetyCtrl.getBlockedUsers);
router.post('/safety/reports', requireAuth, reportRateLimiter, safetyCtrl.report);

// ==========================================
// CHAT & MESSAGING ROUTES
// ==========================================
router.get('/chat/conversations', requireAuth, chatCtrl.getConversations);
router.get('/chat/conversations/:conversationId/messages', requireAuth, chatCtrl.getMessages);
router.post('/chat/conversations/:conversationId/messages', requireAuth, chatRateLimiter, chatCtrl.sendMessage);
router.delete('/chat/conversations/:conversationId/messages', requireAuth, chatRateLimiter, chatCtrl.deleteConversationMessages);
router.put('/chat/messages/:messageId', requireAuth, chatRateLimiter, chatCtrl.editMessage);
router.delete('/chat/messages/:messageId', requireAuth, chatRateLimiter, chatCtrl.deleteMessage);
router.post('/chat/conversations/:conversationId/seen', requireAuth, typingRateLimiter, chatCtrl.markSeen);
router.post('/chat/conversations/:conversationId/delivered', requireAuth, typingRateLimiter, chatCtrl.markDelivered);
router.post('/chat/conversations/:conversationId/typing', requireAuth, typingRateLimiter, chatCtrl.postTyping);
router.get('/chat/conversations/:conversationId/typing', requireAuth, typingRateLimiter, chatCtrl.getTyping);

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
router.get('/push/vapid-public-key', pushRateLimiter, pushCtrl.getVapidPublicKey);
router.post('/push/subscribe', requireAuth, pushRateLimiter, pushCtrl.subscribe);
router.post('/push/unsubscribe', requireAuth, pushRateLimiter, pushCtrl.unsubscribe);

// ==========================================
// WARNING & APPEAL ROUTES (User)
// ==========================================
router.get('/warnings/active', requireAuth, warningCtrl.getActiveWarning);
router.post('/warnings/:warningId/appeal', requireAuth, warningCtrl.submitAppeal);

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================
router.get('/admin/stats', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getDashboardStats);
router.get('/admin/users', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getUsers);
router.post('/admin/users/:userId/suspend', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.suspendUser);
router.post('/admin/users/:userId/restore', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.restoreUser);
router.post('/admin/users/:userId/delete', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.deleteUser);
router.get('/admin/users/pending', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getPendingQueue);
router.post('/admin/users/:userId/approve', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.approve);
router.post('/admin/users/:userId/reject', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.reject);
router.get('/admin/users/history', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getPhoneHistory);
router.get('/admin/users/:userId', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getUserById);
router.get('/admin/reports', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getReports);
router.post('/admin/reports/:reportId/close', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.closeReport);
router.get('/admin/logs', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getAuditLogs);
router.get('/admin/verifications', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getVerificationRequests);
router.post('/admin/verifications/demo', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.createDemoVerification);
router.post('/admin/verifications/:id/approve', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.approveVerification);
router.post('/admin/verifications/:id/reject', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.rejectVerification);
router.post('/admin/users/:userId/verify', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.toggleUserVerification);

// Admin Warning Management
router.post('/admin/users/:userId/warn', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.issueWarning);
router.get('/admin/warnings', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.getWarnings);
router.post('/admin/warnings/:warningId/resolve', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), adminActionLimiter, adminCtrl.resolveWarning);

// SUPER ADMIN ONLY OPERATIONS
router.post('/admin/create', requireAuth, requireRole(['SUPER_ADMIN']), adminPrivilegeLimiter, adminCtrl.createAdmin);
router.post('/admin/remove', requireAuth, requireRole(['SUPER_ADMIN']), adminPrivilegeLimiter, adminCtrl.removeAdmin);

export default router;

