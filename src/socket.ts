import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from './utils/logger';
import { firebaseAuth } from './config/firebase';
import { prisma } from './config/database';

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

export function initSocketServer(httpServer: HttpServer, corsOrigin: string) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
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
        const email = token.replace('dev-google:', '');
        user = await prisma.user.findFirst({ where: { email } });
        if (!user) {
          user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
        }
      } else {
        try {
          const decoded = await firebaseAuth().verifyIdToken(token);
          user = await prisma.user.findUnique({
            where: { firebaseUid: decoded.uid },
          });
        } catch (err: any) {
          if (process.env.NODE_ENV !== 'production') {
            user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
          } else {
            throw err;
          }
        }
      }

      if (!user) {
        return next(new Error('User not found'));
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

    // Join a specific conversation room
    socket.on('join_conversation', (conversationId: string) => {
      if (conversationId) {
        socket.join(conversationId);
        logger.debug(`Socket user ${userId} joined room: ${conversationId}`);
      }
    });

    // Leave a specific conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      if (conversationId) {
        socket.leave(conversationId);
        logger.debug(`Socket user ${userId} left room: ${conversationId}`);
      }
    });

    // Handle typing start
    socket.on('typing_start', (conversationId: string) => {
      if (conversationId) {
        socket.to(conversationId).emit('typing', {
          conversationId,
          userId,
          isTyping: true,
        });
      }
    });

    // Handle typing stop
    socket.on('typing_stop', (conversationId: string) => {
      if (conversationId) {
        socket.to(conversationId).emit('typing', {
          conversationId,
          userId,
          isTyping: false,
        });
      }
    });

    // Handle mark seen
    socket.on('mark_seen', async (conversationId: string) => {
      if (conversationId && userId) {
        try {
          const { ChatService } = await import('./services/chat.service');
          const chatService = new ChatService();
          await chatService.markSeen(conversationId, userId);
        } catch (e: any) {
          logger.error('Socket mark_seen error:', e?.message || e);
        }
      }
    });

    // Handle Nudge Spark
    socket.on('nudge_spark', async ({ targetUserId, senderName }: { targetUserId: string; senderName?: string }) => {
      if (targetUserId) {
        io.to(targetUserId).emit('spark_nudged', {
          senderId: userId,
          senderName: senderName || 'Someone',
          message: `${senderName || 'Someone'} nudged your spark! Say hi 👋`,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('disconnect', () => {
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
