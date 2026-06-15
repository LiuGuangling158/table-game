import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from 'shared';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error:', err.message, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: ERROR_CODES.INTERNAL_ERROR,
    message: '服务器内部错误',
  });
}
