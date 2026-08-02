import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { firebaseAuth } from '../config/firebase';

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

    const decoded = await firebaseAuth().verifyIdToken(token);

    // Enforce suspension & deletion block
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status === 'DELETED') {
      return res.status(403).json({ success: false, message: 'Your account has been deleted' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended' });
    }
    
    req.user = {
      userId: user.id,
      role: user.role,
      approvalStatus: user.approvalStatus
    };
    return next();
  } catch (error: any) {
    console.log(error);
    logger.debug('Firebase token validation failed:', error.message);
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
