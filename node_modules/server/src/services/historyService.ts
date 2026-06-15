import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class HistoryService {
  /**
   * 获取用户游戏历史
   */
  async getUserHistory(userId: string, page: number = 1, pageSize: number = 20) {
    // 查找用户参与过的所有游戏记录
    const gamePlayerRecords = await prisma.gamePlayer.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            record: true,
            players: {
              include: {
                user: {
                  select: { id: true, nickname: true, avatar: true },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await prisma.gamePlayer.count({ where: { userId } });

    const items = gamePlayerRecords
      .filter(gp => gp.room.record)
      .map(gp => ({
        id: gp.room.record!.id,
        gameType: gp.room.gameType,
        players: gp.room.players.map(p => ({
          userId: p.userId,
          nickname: p.user.nickname,
          color: p.color,
        })),
        winnerId: gp.room.record!.winnerId,
        reason: gp.room.record!.reason,
        duration: gp.room.record!.duration,
        createdAt: gp.room.record!.createdAt.toISOString(),
      }));

    return { items, total, page, pageSize };
  }

  /**
   * 获取单局详情(含棋谱)
   */
  async getGameDetail(recordId: string) {
    const record = await prisma.gameRecord.findUnique({
      where: { id: recordId },
      include: {
        room: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, nickname: true, avatar: true },
                },
              },
            },
            moves: {
              orderBy: { moveNumber: 'asc' },
            },
          },
        },
        winner: {
          select: { id: true, nickname: true },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      gameType: record.gameType,
      players: record.room.players.map(p => ({
        userId: p.userId,
        nickname: p.user.nickname,
        color: p.color,
      })),
      winner: record.winner,
      winnerId: record.winnerId,
      reason: record.reason,
      duration: record.duration,
      moves: record.room.moves.map(m => ({
        moveNumber: m.moveNumber,
        userId: m.userId,
        moveData: m.moveData,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: record.createdAt.toISOString(),
    };
  }

  /**
   * 获取用户战绩统计
   */
  async getUserStats(userId: string) {
    // 总对局数：用户参与的、有游戏记录的房间
    const totalGames = await prisma.gamePlayer.count({
      where: {
        userId,
        room: {
          record: { isNot: null },
        },
      },
    });

    // 胜场数
    const wins = await prisma.gameRecord.count({
      where: {
        winnerId: userId,
      },
    });

    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    return {
      totalGames,
      wins,
      winRate,
    };
  }
}

export const historyService = new HistoryService();
