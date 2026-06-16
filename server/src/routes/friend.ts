import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { friendService } from '../services/friendService';
import { getIO, getUserSockets } from '../socket';

const router = Router();

router.use(authMiddleware);

// 通知工具函数
function notifyUser(userId: string, event: string, data: any) {
  const io = getIO();
  if (!io) return;
  const sockets = getUserSockets(io, userId);
  sockets.forEach(s => s.emit(event, data));
}

// GET /api/friends — 获取好友列表
router.get('/', async (req, res: Response) => {
  const friends = await friendService.getFriendList(req.user!.userId);
  res.json({ success: true, data: friends });
});

// POST /api/friends/request — 发送好友请求
router.post('/request', async (req, res: Response) => {
  const { receiverId, message } = req.body;
  if (!receiverId || typeof receiverId !== 'string') {
    res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: '缺少接收者ID' });
    return;
  }
  const result = await friendService.sendRequest(req.user!.userId, receiverId, message);

  // 实时通知接收者
  if (result.status === 'pending') {
    notifyUser(receiverId, 'notify:friend_request', {
      fromUser: {
        id: req.user!.userId,
        nickname: req.user!.nickname,
      },
    });
  }

  res.json({ success: true, data: result });
});

// GET /api/friends/requests — 获取收到的好友请求
router.get('/requests', async (req, res: Response) => {
  const requests = await friendService.getPendingRequests(req.user!.userId);
  res.json({ success: true, data: requests });
});

// POST /api/friends/requests/:id/accept — 接受好友请求
router.post('/requests/:id/accept', async (req, res: Response) => {
  const result = await friendService.acceptRequest(req.params.id, req.user!.userId);

  // 实时通知发送者请求已被接受
  if (result.senderId) {
    notifyUser(result.senderId, 'notify:friend_accepted', {
      byUser: {
        id: req.user!.userId,
        nickname: req.user!.nickname,
      },
    });
  }

  res.json({ success: true, message: '已接受好友请求' });
});

// POST /api/friends/requests/:id/reject — 拒绝好友请求
router.post('/requests/:id/reject', async (req, res: Response) => {
  await friendService.rejectRequest(req.params.id, req.user!.userId);
  res.json({ success: true, message: '已拒绝好友请求' });
});

// DELETE /api/friends/:friendId — 删除好友
router.delete('/:friendId', async (req, res: Response) => {
  await friendService.removeFriend(req.user!.userId, req.params.friendId);
  res.json({ success: true, message: '已删除好友' });
});

export default router;
