import { Router, Request, Response } from 'express';
import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authService } from '../services/authService';
import { signToken, verifyToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { ERROR_CODES } from 'shared';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/dev/login — 开发模式登录 (无需真实的 OAuth)
router.post('/dev/login', async (req: Request, res: Response) => {
  try {
    const { platform } = req.body; // 'wechat' | 'qq'
    const nickname = platform === 'wechat' ? '微信用户' : platform === 'qq' ? 'QQ用户' : '开发用户';
    const devOpenId = `dev_${platform || 'test'}_${Date.now()}`;

    // 查找或创建开发用户
    let user = await prisma.user.findUnique({ where: { openId: devOpenId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          openId: devOpenId,
          oauthPlatform: platform || 'dev',
          nickname,
          avatar: null,
          status: UserStatus.ONLINE,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ONLINE },
      });
    }

    const tokens = signToken({ userId: user.id, nickname: user.nickname });

    res.json({
      success: true,
      data: {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          oauthPlatform: user.oauthPlatform,
          status: user.status,
        },
      },
    });
  } catch (error: any) {
    throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, error.message || 'Dev登录失败');
  }
});

// GET /api/auth/wechat/url — 获取微信授权 URL
router.get('/wechat/url', (req: Request, res: Response) => {
  const redirectUri = req.query.redirect_uri as string || `${req.protocol}://${req.get('host')}/api/auth/wechat/callback`;
  const state = Math.random().toString(36).substring(2, 15);
  const url = authService.getOAuthUrl('wechat', redirectUri, state);

  res.json({ success: true, data: { url, state } });
});

// GET /api/auth/qq/url — 获取 QQ 授权 URL
router.get('/qq/url', (req: Request, res: Response) => {
  const redirectUri = req.query.redirect_uri as string || `${req.protocol}://${req.get('host')}/api/auth/qq/callback`;
  const state = Math.random().toString(36).substring(2, 15);
  const url = authService.getOAuthUrl('qq', redirectUri, state);

  res.json({ success: true, data: { url, state } });
});

// POST /api/auth/wechat/callback — 微信授权回调
router.post('/wechat/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '缺少code参数');
    }

    const result = await authService.loginWithWechat(code);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, ERROR_CODES.OAUTH_FAILED, error.message || '微信登录失败');
  }
});

// POST /api/auth/qq/callback — QQ 授权回调
router.post('/qq/callback', async (req: Request, res: Response) => {
  try {
    const { code, redirect_uri } = req.body;
    if (!code) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '缺少code参数');
    }

    const result = await authService.loginWithQQ(code, redirect_uri || '');
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, ERROR_CODES.OAUTH_FAILED, error.message || 'QQ登录失败');
  }
});

// POST /api/auth/register — 邮箱注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, nickname, password } = req.body;
    if (!email || !nickname || !password) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '请填写邮箱、昵称和密码');
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '邮箱格式不正确');
    }

    // 验证密码长度
    if (password.length < 6) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '密码至少6位');
    }

    // 检查邮箱是否已注册
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(400, 'EMAIL_EXISTS', '该邮箱已注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        nickname,
        password: hashedPassword,
        oauthPlatform: 'email',
        status: UserStatus.ONLINE,
      },
    });

    const tokens = signToken({ userId: user.id, nickname: user.nickname });

    res.json({
      success: true,
      data: {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          oauthPlatform: user.oauthPlatform,
          status: user.status,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, error.message || '注册失败');
  }
});

// POST /api/auth/login — 邮箱密码登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '请输入邮箱和密码');
    }

    // 查找用户
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, '邮箱或密码错误');
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, '邮箱或密码错误');
    }

    // 更新在线状态
    await prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ONLINE },
    });

    const tokens = signToken({ userId: user.id, nickname: user.nickname });

    res.json({
      success: true,
      data: {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          oauthPlatform: user.oauthPlatform,
          status: user.status,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, error.message || '登录失败');
  }
});

// GET /api/auth/me — 获取当前用户信息
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' });
      return;
    }
    const payload = verifyToken(authHeader.split(' ')[1]);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        oauthPlatform: user.oauthPlatform,
        status: user.status,
      },
    });
  } catch (error: any) {
    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, '无效的Token');
  }
});

// POST /api/auth/refresh — 刷新 Token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '缺少refreshToken');
    }

    const result = await authService.refreshToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (error: any) {
    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, '无效的RefreshToken');
  }
});

export default router;
