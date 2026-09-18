import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';

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
  const isProduction = process.env.NODE_ENV === 'production';

  // Sanitize the error message so database and internal details are never leaked
  const userSafeMessage = isProduction 
    ? 'An unexpected error occurred. Please try again after a while.' 
    : sanitizeErrorMessage(error);

  res.status(statusCode).json({
    success: false,
    message: userSafeMessage,
    stack: isProduction ? undefined : error.stack,
  });
}
