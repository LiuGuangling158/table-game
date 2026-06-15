import { PrismaClient, UserStatus } from '@prisma/client';
import { signToken, verifyRefreshToken } from '../utils/jwt';
import {
  getWechatAccessToken,
  getWechatUserInfo,
  getQQAccessToken,
  getQQUserInfo,
  getWechatAuthUrl,
  getQQAuthUrl,
} from '../config/oauth';
import { config } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class AuthService {
  /**
   * 微信登录
   */
  async loginWithWechat(code: string) {
    const { access_token, openid, unionid } = await getWechatAccessToken(code);
    const { nickname, avatar } = await getWechatUserInfo(access_token, openid);

    return this.upsertUser({
      openId: openid,
      unionId: unionid || null,
      platform: 'wechat',
      nickname,
      avatar,
    });
  }

  /**
   * QQ登录
   */
  async loginWithQQ(code: string, redirectUri: string) {
    const { access_token, openid } = await getQQAccessToken(code, redirectUri);
    const { nickname, avatar } = await getQQUserInfo(access_token, openid, config.oauth.qq.appId);

    return this.upsertUser({
      openId: openid,
      unionId: null,
      platform: 'qq',
      nickname,
      avatar,
    });
  }

  /**
   * 创建或更新用户，返回 JWT
   */
  private async upsertUser(params: {
    openId: string;
    unionId: string | null;
    platform: string;
    nickname: string;
    avatar: string;
  }) {
    const { openId, unionId, platform, nickname, avatar } = params;

    // 查找已有用户
    let user = await prisma.user.findUnique({
      where: { openId },
    });

    if (user) {
      // 更新用户信息
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          nickname,
          avatar,
          status: UserStatus.ONLINE,
        },
      });
    } else {
      // 创建新用户
      user = await prisma.user.create({
        data: {
          openId,
          unionId,
          oauthPlatform: platform,
          nickname,
          avatar,
          status: UserStatus.ONLINE,
        },
      });
    }

    logger.info(`User ${user.id} (${user.nickname}) logged in via ${platform}`);

    // 签发 JWT
    const tokens = signToken({ userId: user.id, nickname: user.nickname });

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
   * 刷新 Token
   */
  async refreshToken(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new Error('用户不存在');
    }

    const tokens = signToken({ userId: user.id, nickname: user.nickname });

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

  /**
   * 获取 OAuth 授权 URL
   */
  getOAuthUrl(platform: 'wechat' | 'qq', redirectUri: string, state: string): string {
    if (platform === 'wechat') {
      return getWechatAuthUrl(redirectUri, state);
    } else {
      return getQQAuthUrl(redirectUri, state);
    }
  }
}

export const authService = new AuthService();
