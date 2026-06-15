import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { ERROR_CODES } from 'shared';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
      message: '请先登录',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Token已过期，请重新登录',
      });
      return;
    }
    res.status(401).json({
      success: false,
      error: ERROR_CODES.INVALID_TOKEN,
      message: '无效的Token',
    });
  }
}

// 可选的认证 — 不强制，但如果有 token 就解析
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = verifyToken(token);
    } catch {
      // Ignore invalid tokens in optional auth
    }
  }
  next();
}
