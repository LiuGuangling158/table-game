import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId: string;
  nickname: string;
}

export function signToken(payload: TokenPayload): { token: string; refreshToken: string } {
  const token = jwt.sign({ ...payload }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as any);

  const refreshToken = jwt.sign({ ...payload }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as any);

  return { token, refreshToken };
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
}
