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
  
  res.status(statusCode).json({
    success: false,
    message: error.message || 'An internal server error occurred',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
}
