import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(`Error encountered: ${error.message}`, {
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  // [M-3 FIX] Mask raw error messages in production to prevent information leakage
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: isProduction ? 'An internal server error occurred' : (error.message || 'An internal server error occurred'),
    stack: isProduction ? undefined : error.stack,
  });
}
