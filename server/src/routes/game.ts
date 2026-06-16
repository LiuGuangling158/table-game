import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { gameService } from '../services/gameService';
import { AppError } from '../middleware/errorHandler';
import { ERROR_CODES } from 'shared';

const router = Router();

router.use(authMiddleware);

// GET /api/games/rooms — 获取房间列表
router.get('/rooms', async (req, res: Response) => {
  const gameType = req.query.gameType as any;
  const rooms = await gameService.getRooms(gameType);

  const formattedRooms = rooms.map(r => ({
    id: r.id,
    gameType: r.gameType,
    status: r.status,
    maxPlayers: r.maxPlayers,
    hostId: r.hostId,
    players: r.players.map(p => ({
      userId: p.user.id,
      nickname: p.user.nickname,
      avatar: p.user.avatar,
      color: p.color,
      ready: p.ready,
    })),
    createdAt: r.createdAt.toISOString(),
  }));

  res.json({ success: true, data: formattedRooms });
});

// POST /api/games/rooms — 创建房间
router.post('/rooms', async (req, res: Response) => {
  const { gameType, maxPlayers } = req.body;
  if (!gameType) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '请选择游戏类型');
  }

  const room = await gameService.createRoom(req.user!.userId, gameType, maxPlayers || 2);

  res.json({
    success: true,
    data: {
      id: room.id,
      gameType: room.gameType,
      status: room.status,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      players: room.players.map(p => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        avatar: p.user.avatar,
        color: p.color,
        ready: p.ready,
      })),
      createdAt: room.createdAt.toISOString(),
    },
  });
});

// GET /api/games/rooms/:id — 获取房间详情
router.get('/rooms/:id', async (req, res: Response) => {
  const room = await gameService.getRoom(req.params.id);
  if (!room) {
    throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, '房间不存在');
  }

  res.json({
    success: true,
    data: {
      id: room.id,
      gameType: room.gameType,
      status: room.status,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      players: room.players.map(p => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        avatar: p.user.avatar,
        color: p.color,
        ready: p.ready,
      })),
      createdAt: room.createdAt.toISOString(),
    },
  });
});

// POST /api/games/rooms/:id/join — 加入房间
router.post('/rooms/:id/join', async (req, res: Response) => {
  const room: any = await gameService.joinRoom(req.params.id, req.user!.userId);
  res.json({
    success: true,
    data: {
      id: room.id,
      gameType: room.gameType,
      status: room.status,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      players: room.players.map((p: any) => ({
        userId: p.user?.id || p.userId,
        nickname: p.user?.nickname || '',
        avatar: p.user?.avatar || null,
        color: p.color,
        ready: p.ready,
      })),
      createdAt: room.createdAt?.toISOString?.() || room.createdAt,
    },
  });
});

// POST /api/games/rooms/:id/leave — 离开房间
router.post('/rooms/:id/leave', async (req, res: Response) => {
  await gameService.leaveRoom(req.params.id, req.user!.userId);
  res.json({ success: true, message: '已离开房间' });
});

export default router;
