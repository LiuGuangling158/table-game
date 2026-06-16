import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { historyService } from '../services/historyService';

const router = Router();

router.use(authMiddleware);

// GET /api/history — 获取个人游戏历史
router.get('/', async (req, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const result = await historyService.getUserHistory(req.user!.userId, page, pageSize);
  res.json({ success: true, data: result });
});

// GET /api/history/:id — 获取单局详情
router.get('/:id', async (req, res: Response) => {
  const detail = await historyService.getGameDetail(req.params.id, req.user!.userId);
  if (!detail) {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: '记录不存在' });
    return;
  }
  res.json({ success: true, data: detail });
});

export default router;
