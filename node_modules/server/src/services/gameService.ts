import { PrismaClient, GameType, RoomStatus, PlayerColor, EndReason } from '@prisma/client';
import { ERROR_CODES } from 'shared';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class GameService {
  /**
   * 获取房间列表
   */
  async getRooms(gameType?: GameType) {
    const where: any = {
      status: { in: [RoomStatus.WAITING, RoomStatus.PLAYING] },
    };
    if (gameType) {
      where.gameType = gameType;
    }

    return prisma.gameRoom.findMany({
      where,
      include: {
        players: {
          include: {
            user: {
              select: { id: true, nickname: true, avatar: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * 创建房间
   */
  async createRoom(hostId: string, gameType: GameType, maxPlayers: number = 2) {
    const room = await prisma.gameRoom.create({
      data: {
        gameType,
        maxPlayers,
        hostId,
        status: RoomStatus.WAITING,
        players: {
          create: {
            userId: hostId,
            color: this.getFirstColor(gameType),
            ready: false,
          },
        },
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, nickname: true, avatar: true },
            },
          },
        },
      },
    });

    return room;
  }

  /**
   * 加入房间 — 防御式颜色分配，逐个尝试避免冲突
   */
  async joinRoom(roomId: string, userId: string, preferredColor?: PlayerColor) {
    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: { players: true },
    });

    if (!room) {
      throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, '房间不存在');
    }

    if (room.status !== RoomStatus.WAITING) {
      throw new AppError(400, ERROR_CODES.GAME_ALREADY_STARTED, '游戏已开始');
    }

    // 检查是否已在房间中
    const alreadyIn = room.players.find(p => p.userId === userId);
    if (alreadyIn) {
      return room;
    }

    // 获取该游戏类型的所有合法颜色，按顺序尝试
    const colorCandidates = this.getAllColors(room.gameType);
    // 优先使用 preferredColor
    if (preferredColor) {
      const idx = colorCandidates.indexOf(preferredColor);
      if (idx > 0) {
        colorCandidates.splice(idx, 1);
        colorCandidates.unshift(preferredColor);
      }
    }

    // 逐个尝试创建，成功则返回
    let lastError: any;
    for (const color of colorCandidates) {
      try {
        await prisma.gamePlayer.create({
          data: { roomId, userId, color, ready: false },
        });
        // 创建成功！返回房间信息
        return prisma.gameRoom.findUnique({
          where: { id: roomId },
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, nickname: true, avatar: true },
                },
              },
            },
          },
        });
      } catch (err: any) {
        lastError = err;
        // P2002 = Prisma unique constraint violation, try next color
        if (err?.code === 'P2002') continue;
        throw err;
      }
    }

    // 所有颜色都冲突 → 房间已满
    throw new AppError(400, ERROR_CODES.ROOM_FULL, '房间已满');
  }

  /**
   * 离开房间
   */
  async leaveRoom(roomId: string, userId: string) {
    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: { players: true },
    });

    if (!room) {
      throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, '房间不存在');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new AppError(400, ERROR_CODES.NOT_IN_ROOM, '不在房间中');
    }

    // 删除玩家
    await prisma.gamePlayer.delete({ where: { id: player.id } });

    // 如果房间空了，取消房间
    const remainingPlayers = await prisma.gamePlayer.count({ where: { roomId } });
    if (remainingPlayers === 0) {
      await prisma.gameRoom.update({
        where: { id: roomId },
        data: { status: RoomStatus.CANCELLED },
      });
    }

    return { success: true };
  }

  /**
   * 设置准备状态
   */
  async setReady(roomId: string, userId: string, ready: boolean) {
    const player = await prisma.gamePlayer.findFirst({
      where: { roomId, userId },
    });

    if (!player) {
      throw new AppError(400, ERROR_CODES.NOT_IN_ROOM, '不在房间中');
    }

    await prisma.gamePlayer.update({
      where: { id: player.id },
      data: { ready },
    });

    return { success: true };
  }

  /**
   * 开始游戏
   */
  async startGame(roomId: string) {
    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: { players: true },
    });

    if (!room) {
      throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, '房间不存在');
    }

    if (room.players.length < 2) {
      throw new AppError(400, ERROR_CODES.NOT_ENOUGH_PLAYERS, '玩家不足');
    }

    const allReady = room.players.every(p => p.ready);
    if (!allReady) {
      throw new AppError(400, 'NOT_ALL_READY', '有玩家未准备');
    }

    return prisma.gameRoom.update({
      where: { id: roomId },
      data: {
        status: RoomStatus.PLAYING,
        startedAt: new Date(),
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, nickname: true, avatar: true },
            },
          },
        },
      },
    });
  }

  /**
   * 结束游戏
   * @param winnerColor 胜者颜色 (null = 平局)，内部解析为 userId
   */
  async endGame(roomId: string, winnerColor: PlayerColor | null, reason: EndReason, duration?: number) {
    const room = await prisma.gameRoom.findUnique({ where: { id: roomId } });

    if (!room) {
      throw new AppError(404, ERROR_CODES.ROOM_NOT_FOUND, '房间不存在');
    }

    // 将颜色解析为 userId
    let winnerId: string | null = null;
    if (winnerColor) {
      const winner = await prisma.gamePlayer.findFirst({
        where: { roomId, color: winnerColor },
      });
      winnerId = winner?.userId || null;
    }

    // 更新房间状态
    await prisma.gameRoom.update({
      where: { id: roomId },
      data: {
        status: RoomStatus.FINISHED,
        endedAt: new Date(),
      },
    });

    // 创建游戏记录
    return prisma.gameRecord.create({
      data: {
        roomId,
        gameType: room.gameType,
        winnerId,
        reason,
        duration,
      },
    });
  }

  /**
   * 保存走法
   */
  async saveMove(roomId: string, userId: string, moveData: any, moveNumber: number) {
    return prisma.gameMove.create({
      data: {
        roomId,
        userId,
        moveData,
        moveNumber,
      },
    });
  }

  /**
   * 获取房间详情
   */
  async getRoom(roomId: string) {
    return prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, nickname: true, avatar: true },
            },
          },
        },
      },
    });
  }

  // ==================== 辅助方法 ====================

  private getFirstColor(gameType: GameType): PlayerColor {
    switch (gameType) {
      case GameType.GOMOKU:
      case GameType.CHESS:
        return PlayerColor.BLACK;
      case GameType.XIANGQI:
        return PlayerColor.RED;
      default:
        return PlayerColor.BLACK;
    }
  }

  private getAvailableColor(gameType: GameType, usedColors: PlayerColor[]): PlayerColor {
    switch (gameType) {
      case GameType.GOMOKU:
      case GameType.CHESS:
        return usedColors.includes(PlayerColor.BLACK) ? PlayerColor.WHITE : PlayerColor.BLACK;
      case GameType.XIANGQI:
        return usedColors.includes(PlayerColor.RED) ? PlayerColor.BLUE : PlayerColor.RED;
      default:
        return PlayerColor.WHITE;
    }
  }

  private getAllColors(gameType: GameType): PlayerColor[] {
    switch (gameType) {
      case GameType.GOMOKU:
      case GameType.CHESS:
        return [PlayerColor.BLACK, PlayerColor.WHITE];
      case GameType.XIANGQI:
        return [PlayerColor.RED, PlayerColor.BLUE];
      default:
        return [PlayerColor.BLACK, PlayerColor.WHITE];
    }
  }
}

export const gameService = new GameService();
