import { PrismaClient, UserStatus } from '@prisma/client';
import { signToken, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class AuthService {
  /**
   * 刷新 Token — 使用 tokenVersion 轮换机制防止重复使用
   */
  async refreshToken(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证 tokenVersion: 如果 token 中的版本与数据库不一致，说明该 refreshToken 已被使用过
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      throw new Error('RefreshToken已被使用，请重新登录');
    }

    // 递增 tokenVersion，使旧 token 立即失效
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: user.tokenVersion + 1 },
    });

    const tokens = signToken({ userId: user.id, nickname: user.nickname, tokenVersion: updatedUser.tokenVersion });

    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        oauthPlatform: user.oauthPlatform,
        status: user.status,
      },
    };
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      oauthPlatform: user.oauthPlatform,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

}

export const authService = new AuthService();
