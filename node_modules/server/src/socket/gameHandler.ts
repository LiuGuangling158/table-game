import { Server, Socket } from 'socket.io';
import { GameType, EndReason } from '@prisma/client';
import { GomokuEngine } from '../games/gomoku/GomokuEngine';
import { XiangqiEngine } from '../games/xiangqi/XiangqiEngine';
import { ChessEngine } from '../games/chess/ChessEngine';
import { GameEngine } from '../games/base/GameEngine';
import { gameService } from '../services/gameService';
import { BoardState, Move, PlayerColor } from 'shared';
import { logger } from '../utils/logger';

interface ActiveGame {
  engine: GameEngine;
  state: BoardState;
  /** color → userId 映射，用于验证玩家身份 */
  playerUsers: Map<string, string>;
}

// 存储活跃的游戏实例: roomId -> ActiveGame
const activeGames = new Map<string, ActiveGame>();

// 存储游戏计时器: roomId -> { playerTimers, interval }
const gameTimers = new Map<string, any>();

function getEngine(gameType: GameType): GameEngine {
  switch (gameType) {
    case GameType.GOMOKU: return new GomokuEngine();
    case GameType.XIANGQI: return new XiangqiEngine();
    case GameType.CHESS: return new ChessEngine();
    default: throw new Error(`未知游戏类型: ${gameType}`);
  }
}

/** 序列化合法走法为前端可用的格式 */
function serializeLegalMoves(engine: GameEngine, state: BoardState, color: PlayerColor) {
  return engine.getAllValidMoves(state, color).map(m => ({
    from: [m.from.row, m.from.col] as [number, number],
    to: [m.to.row, m.to.col] as [number, number],
  }));
}

export function handleGame(io: Server, socket: Socket): void {
  const user = (socket as any).user;

  // 初始化游戏 (在 game_start 后由客户端或服务端触发)
  socket.on('game:init', async (data: { roomId: string; gameType: GameType }) => {
    try {
      // 幂等：如果已初始化，直接返回当前状态
      if (activeGames.has(data.roomId)) {
        const existing = activeGames.get(data.roomId)!;
        const legalMoves = serializeLegalMoves(existing.engine, existing.state, existing.state.currentPlayer);
        socket.emit('game:sync', {
          fullState: existing.state,
          currentPlayer: existing.state.currentPlayer,
          legalMoves,
        });
        return;
      }

      // 验证该用户是否是房间中的玩家
      const room = await gameService.getRoom(data.roomId);
      if (!room) {
        socket.emit('notify:error', { code: 'GAME_ERROR', message: '房间不存在' });
        return;
      }
      const isPlayer = room.players.some(p => p.userId === user.userId);
      if (!isPlayer) {
        socket.emit('notify:error', { code: 'GAME_ERROR', message: '你不是该房间的玩家' });
        return;
      }

      // 构建 playerUsers 映射: color → userId
      const playerUsers = new Map<string, string>();
      for (const p of room.players) {
        playerUsers.set(p.color, p.userId);
      }

      const engine = getEngine(data.gameType);
      const initialState = engine.getInitialState();
      activeGames.set(data.roomId, { engine, state: initialState, playerUsers });

      const initLegalMoves = serializeLegalMoves(engine, initialState, initialState.currentPlayer);
      io.to(data.roomId).emit('game:sync', {
        fullState: initialState,
        currentPlayer: initialState.currentPlayer,
        legalMoves: initLegalMoves,
      });

      logger.info(`游戏初始化: ${data.roomId} (${data.gameType}), 玩家: ${[...playerUsers.entries()].map(([c, u]) => `${c}=${u}`).join(', ')}`);
    } catch (error: any) {
      socket.emit('notify:error', { code: 'GAME_ERROR', message: error.message });
    }
  });

  // 走棋
  socket.on('game:move', async (data: { roomId: string; move: Move }) => {
    try {
      const gameData = activeGames.get(data.roomId);
      if (!gameData) {
        socket.emit('notify:error', { code: 'GAME_ERROR', message: '游戏未初始化' });
        return;
      }

      const { engine, state, playerUsers } = gameData;

      // 验证当前玩家：操作用户必须是对应 currentPlayer 颜色的玩家
      const currentPlayerUserId = playerUsers.get(state.currentPlayer);
      if (currentPlayerUserId !== user.userId) {
        socket.emit('game:move_result', {
          valid: false,
          message: '还没轮到你走棋',
          move: data.move,
        });
        return;
      }

      // 引擎内部的 validateMove 会校验走棋合法性(含回合、颜色校验)
      // 执行走棋
      const result = engine.makeMove(state, data.move);

      if (!result.valid) {
        socket.emit('game:move_result', {
          valid: false,
          message: result.message,
          move: data.move,
        });
        return;
      }

      // 更新游戏状态 (保留 playerUsers 映射)
      const newState = result.newState!;
      activeGames.set(data.roomId, { engine, state: newState, playerUsers });

      // 保存走法到数据库
      await gameService.saveMove(data.roomId, user.userId, data.move, newState.moveCount);

      // 广播走棋结果
      io.to(data.roomId).emit('game:move_result', {
        valid: true,
        move: data.move,
        newState,
        captured: result.captured,
        isCheck: result.isCheck,
      });

      // 广播当前轮到谁 (附带合法走法供前端高亮)
      const turnLegalMoves = serializeLegalMoves(engine, newState, newState.currentPlayer);
      io.to(data.roomId).emit('game:turn', {
        currentPlayer: newState.currentPlayer,
        legalMoves: turnLegalMoves,
      });

      // 检查游戏是否结束
      const gameOver = engine.checkGameOver(newState);
      if (gameOver) {
        io.to(data.roomId).emit('game:over', {
          winner: gameOver.winner,
          reason: gameOver.reason,
          finalState: gameOver.finalState,
        });

        // 保存游戏记录 (winner 为 PlayerColor，endGame 内部解析为 userId)
        await gameService.endGame(
          data.roomId,
          gameOver.winner,
          gameOver.reason as any, // shared.EndReason → prisma.EndReason (同值不同型)
        );

        // 清理游戏实例
        activeGames.delete(data.roomId);
        cleanupTimer(data.roomId);

        logger.info(`游戏结束: ${data.roomId}, 胜者: ${gameOver.winner}, 原因: ${gameOver.reason}`);
      }
    } catch (error: any) {
      socket.emit('notify:error', { code: 'GAME_ERROR', message: error.message });
    }
  });

  // 认输
  socket.on('game:resign', async (data: { roomId: string }) => {
    try {
      const gameData = activeGames.get(data.roomId);
      if (!gameData) return;

      // 从 playerUsers 映射中查找认输者颜色 (不能直接用 currentPlayer)
      let resignColor: string | undefined;
      for (const [color, uid] of gameData.playerUsers) {
        if (uid === user.userId) {
          resignColor = color;
          break;
        }
      }

      if (!resignColor) {
        socket.emit('notify:error', { code: 'GAME_ERROR', message: '你不是游戏参与者' });
        return;
      }

      // 使用引擎的 getNextPlayer 获取胜者颜色（按不同游戏类型的颜色规则）
      const winner = gameData.engine.getNextPlayer(resignColor as PlayerColor);

      io.to(data.roomId).emit('game:over', {
        winner,
        reason: EndReason.RESIGN,
        finalState: gameData.state,
      });

      await gameService.endGame(data.roomId, winner as PlayerColor, EndReason.RESIGN);
      activeGames.delete(data.roomId);
      cleanupTimer(data.roomId);

      logger.info(`游戏结束: ${data.roomId}, 认输: ${resignColor}, 胜者: ${winner}`);
    } catch (error: any) {
      socket.emit('notify:error', { code: 'GAME_ERROR', message: error.message });
    }
  });

  // 求和请求
  socket.on('game:draw_request', (data: { roomId: string }) => {
    const gameData = activeGames.get(data.roomId);
    if (!gameData) return;

    // 验证请求者是游戏参与者
    const isPlayer = [...gameData.playerUsers.values()].includes(user.userId);
    if (!isPlayer) {
      socket.emit('notify:error', { code: 'GAME_ERROR', message: '你不是游戏参与者' });
      return;
    }

    socket.to(data.roomId).emit('game:draw_request', { fromUserId: user.userId });
  });

  // 求和回应
  socket.on('game:draw_response', async (data: { roomId: string; accept: boolean }) => {
    if (data.accept) {
      const gameData = activeGames.get(data.roomId);
      if (!gameData) return;

      // 验证回应者是游戏参与者
      const isPlayer = [...gameData.playerUsers.values()].includes(user.userId);
      if (!isPlayer) {
        socket.emit('notify:error', { code: 'GAME_ERROR', message: '你不是游戏参与者' });
        return;
      }

      io.to(data.roomId).emit('game:over', {
        winner: null,
        reason: EndReason.DRAW,
        finalState: gameData.state,
      });

      await gameService.endGame(data.roomId, null, EndReason.DRAW);
      activeGames.delete(data.roomId);
      cleanupTimer(data.roomId);

      logger.info(`游戏结束: ${data.roomId}, 和棋`);
    } else {
      socket.to(data.roomId).emit('game:draw_response', { accept: false });
    }
  });

  // 获取游戏状态 (进入房间时 / 断线重连)
  socket.on('game:get_state', (data: { roomId: string }) => {
    const gameData = activeGames.get(data.roomId);
    if (!gameData) {
      socket.emit('notify:error', { code: 'GAME_ERROR', message: '没有正在进行的游戏' });
      return;
    }

    // 验证请求者是游戏参与者
    const isPlayer = [...gameData.playerUsers.values()].includes(user.userId);
    if (!isPlayer) {
      socket.emit('notify:error', { code: 'GAME_ERROR', message: '你不是游戏参与者' });
      return;
    }

    const syncLegalMoves = serializeLegalMoves(gameData.engine, gameData.state, gameData.state.currentPlayer);
    socket.emit('game:sync', {
      fullState: gameData.state,
      currentPlayer: gameData.state.currentPlayer,
      legalMoves: syncLegalMoves,
    });
  });
}

function cleanupTimer(roomId: string) {
  const timer = gameTimers.get(roomId);
  if (timer) {
    clearInterval(timer.interval);
    gameTimers.delete(roomId);
  }
}
