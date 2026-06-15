import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { authService } from '../services/authService';
import { friendService } from '../services/friendService';
import { historyService } from '../services/historyService';
import { AppError } from '../middleware/errorHandler';
import { ERROR_CODES } from 'shared';

const prisma = new PrismaClient();

const router = Router();

// 所有用户路由需要认证
router.use(authMiddleware);

// 注意：固定路径的路由必须定义在 /:id 参数路由之前，否则会被拦截

// GET /api/users/search?q= — 搜索用户
router.get('/search', async (req, res: Response) => {
  const query = req.query.q as string;
  if (!query || query.length < 1) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '请输入搜索关键词');
  }

  const users = await friendService.searchUsers(query, req.user!.userId);
  res.json({ success: true, data: users });
});

// PUT /api/users/me — 更新个人资料
router.put('/me', async (req, res: Response) => {
  const { nickname, avatar } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(nickname && { nickname }),
      ...(avatar !== undefined && { avatar }),
    },
  });

  res.json({
    success: true,
    data: {
      id: updatedUser.id,
      nickname: updatedUser.nickname,
      avatar: updatedUser.avatar,
      oauthPlatform: updatedUser.oauthPlatform,
      status: updatedUser.status,
    },
  });
});

// GET /api/users/me/stats — 获取当前用户战绩统计
router.get('/me/stats', async (req, res: Response) => {
  const stats = await historyService.getUserStats(req.user!.userId);
  res.json({ success: true, data: stats });
});

// GET /api/users/:id — 获取用户公开信息 (必须放在 /search 和 /me 之后)
router.get('/:id', async (req, res: Response) => {
  const user = await authService.getCurrentUser(req.params.id);
  if (!user) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, '用户不存在');
  }

  // 返回公开信息
  res.json({
    success: true,
    data: {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      status: user.status,
    },
  });
});

export default router;
