import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from './utils/logger';
import { firebaseAuth } from './config/firebase';
import { prisma } from './config/database';
import { env } from './config/env';

export let io: SocketServer;

export function isUserActiveOnline(userId: string): boolean {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(userId);
  return Boolean(room && room.size > 0);
}

export function isUserInConversationRoom(conversationId: string, userId: string): boolean {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(conversationId);
  if (!room) return false;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.data.userId === userId) {
      return true;
    }
  }
  return false;
}

// ============================================================
// [C-2 FIX] Per-socket event rate limiter (token-bucket)
// ============================================================
const eventBuckets = new Map<string, { count: number; resetAt: number }>();

function checkEventRate(socketId: string, event: string, maxPerMinute: number): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const entry = eventBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    eventBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

function cleanupSocketBuckets(socketId: string) {
  for (const key of eventBuckets.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      eventBuckets.delete(key);
    }
  }
}

// [M-4 FIX] Accept string | string[] for CORS origin
export function initSocketServer(httpServer: HttpServer, corsOrigin: string | string[]) {
  // Parse comma-separated origin string into an array for proper multi-origin matching
  const parsedOrigin = typeof corsOrigin === 'string'
    ? corsOrigin.split(',').map(s => s.trim()).filter(Boolean)
    : corsOrigin;

  io = new SocketServer(httpServer, {
    cors: {
      origin: parsedOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      let user: any = null;

      if (token.startsWith('dev-google:')) {
        if (env.NODE_ENV === 'production' || !env.ENABLE_DEV_AUTH) {
          return next(new Error('Invalid or expired authentication token'));
        }
        const email = token.replace('dev-google:', '').trim();
        if (!email) {
          return next(new Error('Invalid or expired authentication token'));
        }
        user = await prisma.user.findFirst({ where: { email } });
      } else {
        let decoded: any;
        try {
          decoded = await firebaseAuth().verifyIdToken(token);
        } catch (err: any) {
          return next(new Error('Invalid or expired authentication token'));
        }

        user = await prisma.user.findUnique({
          where: { firebaseUid: decoded.uid },
        });
      }

      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('User not found or account inactive'));
      }

      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch (error: any) {
      logger.error('Socket authentication failed:', error.message);
      next(new Error('Invalid or expired authentication token'));
    }
  });

  const userSocketCounts = new Map<string, number>();

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(userId);
    logger.debug(`User ${userId} joined personal room`);

    // Track online status
    const currentCount = userSocketCounts.get(userId) || 0;
    userSocketCounts.set(userId, currentCount + 1);

    if (currentCount === 0) {
      io.emit('user_presence', { userId, isOnline: true });
    }

    const onlineUserList = Array.from(userSocketCounts.keys());
    socket.emit('online_users', onlineUserList);
    io.emit('online_users', onlineUserList);

    logger.info(`Socket client connected: ${userId} (${socket.id})`);

    // ============================================================
    // [C-1 FIX] Verify conversation membership before joining room
    // ============================================================
    socket.on('join_conversation', async (conversationId: string) => {
      if (!conversationId) return;

      // Rate limit join attempts
      if (!checkEventRate(socket.id, 'join_conversation', 30)) return;

      try {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { participants: true },
        });

        const isMember = conv?.participants.some(p => p.userId === userId);
        if (!isMember) {
          logger.warn(`Socket: User ${userId} attempted to join unauthorized conversation ${conversationId}`);
          return;
        }

        socket.join(conversationId);
        logger.debug(`Socket user ${userId} joined room: ${conversationId}`);
      } catch (err: any) {
        logger.error('Socket join_conversation error:', err?.message || err);
      }
    });

    // Leave a specific conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      if (conversationId) {
        socket.leave(conversationId);
        logger.debug(`Socket user ${userId} left room: ${conversationId}`);
      }
    });

    // [C-2 FIX] Handle typing start — rate limited
    socket.on('typing_start', (conversationId: string) => {
      if (!conversationId) return;
      if (!checkEventRate(socket.id, 'typing_start', 120)) return;

      socket.to(conversationId).emit('typing', {
        conversationId,
        userId,
        isTyping: true,
      });
    });

    // [C-2 FIX] Handle typing stop — rate limited
    socket.on('typing_stop', (conversationId: string) => {
      if (!conversationId) return;
      if (!checkEventRate(socket.id, 'typing_stop', 120)) return;

      socket.to(conversationId).emit('typing', {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    // [C-2 FIX] Handle mark seen — rate limited
    socket.on('mark_seen', async (conversationId: string) => {
      if (!conversationId || !userId) return;
      if (!checkEventRate(socket.id, 'mark_seen', 60)) return;

      try {
        const { ChatService } = await import('./services/chat.service');
        const chatService = new ChatService();
        await chatService.markSeen(conversationId, userId);
      } catch (e: any) {
        logger.error('Socket mark_seen error:', e?.message || e);
      }
    });

    // ============================================================
    // [C-3 FIX] Verify active match before allowing nudge_spark
    // [C-2 FIX] Rate limited
    // ============================================================
    socket.on('nudge_spark', async ({ targetUserId, senderName }: { targetUserId: string; senderName?: string }) => {
      if (!targetUserId) return;
      if (!checkEventRate(socket.id, 'nudge_spark', 10)) return;

      try {
        // Verify an active match exists between the sender and target
        const match = await prisma.match.findFirst({
          where: {
            unmatched: false,
            OR: [
              { user1Id: userId, user2Id: targetUserId },
              { user1Id: targetUserId, user2Id: userId },
            ],
          },
        });

        if (!match) {
          logger.warn(`Socket: User ${userId} attempted nudge_spark to non-matched user ${targetUserId}`);
          return;
        }

        io.to(targetUserId).emit('spark_nudged', {
          senderId: userId,
          senderName: senderName || 'Someone',
          message: `${senderName || 'Someone'} nudged your spark! Say hi 👋`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logger.error('Socket nudge_spark error:', err?.message || err);
      }
    });

    socket.on('disconnect', () => {
      // Clean up rate limit buckets for this socket
      cleanupSocketBuckets(socket.id);

      const count = userSocketCounts.get(userId) || 1;
      if (count <= 1) {
        userSocketCounts.delete(userId);
        io.emit('user_presence', { userId, isOnline: false });
        io.emit('online_users', Array.from(userSocketCounts.keys()));
      } else {
        userSocketCounts.set(userId, count - 1);
      }
      logger.info(`Socket client disconnected: ${userId} (${socket.id})`);
    });
  });

  return io;
}
