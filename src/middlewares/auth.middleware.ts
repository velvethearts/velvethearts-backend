import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { firebaseAuth } from '../config/firebase';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    approvalStatus: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    let user: any = null;

    if (token.startsWith('dev-google:')) {
      // Dev tokens are strictly disallowed in production or when ENABLE_DEV_AUTH is false
      if (env.NODE_ENV === 'production' || !env.ENABLE_DEV_AUTH) {
        logger.warn('dev-google token rejected in production or when dev auth disabled');
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
      }

      const email = token.replace('dev-google:', '').trim();
      if (!email) {
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
      }

      user = await prisma.user.findFirst({ where: { email } });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
      }
    } else {
      let decoded: any;
      try {
        decoded = await firebaseAuth().verifyIdToken(token);
      } catch (err: any) {
        logger.warn('Firebase token verification failed:', err.message);
        return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
      }

      user = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid }
      });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
    }

    if (user.status === 'DELETED') {
      return res.status(403).json({ success: false, message: 'Your account has been deleted' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended' });
    }
    
    // Informational device ID update (does NOT grant identity or bypass auth)
    const deviceIdHeader = (req.headers['x-device-id'] || req.headers['X-Device-Id']) as string | undefined;
    if (deviceIdHeader && typeof deviceIdHeader === 'string' && user.deviceId !== deviceIdHeader) {
      prisma.user.update({
        where: { id: user.id },
        data: { deviceId: deviceIdHeader.trim() }
      }).catch(err => logger.error('Failed updating deviceId:', err));
    }

    req.user = {
      userId: user.id,
      role: user.role,
      approvalStatus: user.approvalStatus
    };
    return next();
  } catch (error: any) {
    logger.error('Authentication error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
  }
}

export function requireApproved(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.approvalStatus !== 'APPROVED') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access restricted. Your account is under review.', 
      approvalStatus: req.user.approvalStatus 
    });
  }

  return next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    }

    return next();
  };
}
