import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from './utils/logger';
import { firebaseAuth } from './config/firebase';
import { prisma } from './config/database';

export let io: SocketServer;

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
      
      const decoded = await firebaseAuth().verifyIdToken(token);
      const user = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch (error: any) {
      logger.error('Socket Firebase authentication failed:', error.message);
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
