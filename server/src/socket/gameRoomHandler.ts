import { Server, Socket } from 'socket.io';
import { RoomStatus } from '@prisma/client';
import { gameService } from '../services/gameService';
import { getUserSockets } from './index';
import { logger } from '../utils/logger';

// 存储房间的倒计时定时器: roomId → timeoutId
const countdownTimers = new Map<string, NodeJS.Timeout>();

export function handleGameRoom(io: Server, socket: Socket): void {
  const user = (socket as any).user;

  // 加入房间
  socket.on('room:join', async (data: { roomId: string }) => {
    try {
      // 先检查用户是否已是房间玩家（断线重连场景）
      const existingRoom = await gameService.getRoom(data.roomId);
      const existingPlayer = existingRoom?.players.find(
        (p: any) => p.userId === user.userId || p.user?.id === user.userId,
      );

      if (existingPlayer) {
        // 重连：仅重新加入 Socket.IO room，不重复创建 GamePlayer 记录
        socket.join(data.roomId);

        const roomInfo = formatRoomInfo(existingRoom);
        socket.emit('room:joined', { room: roomInfo });

        // 通知房间内其他玩家该用户重新上线
        socket.to(data.roomId).emit('room:player_joined', {
          userId: user.userId,
          nickname: user.nickname,
        });

        return;
      }

      // 正常加入房间流程
      const room = await gameService.joinRoom(data.roomId, user.userId);
      socket.join(data.roomId);

      const roomInfo = formatRoomInfo(room);

      // 通知加入者
      socket.emit('room:joined', { room: roomInfo });

      // 通知房间内其他玩家
      socket.to(data.roomId).emit('room:player_joined', {
        userId: user.userId,
        nickname: user.nickname,
      });

      // 广播大厅更新
      io.to('lobby').emit('lobby:room_updated', { roomId: data.roomId });
    } catch (error: any) {
      socket.emit('notify:error', { code: 'ROOM_ERROR', message: error.message });
    }
  });

  // 离开房间
  socket.on('room:leave', async (data: { roomId: string }) => {
    try {
      await gameService.leaveRoom(data.roomId, user.userId);
      socket.leave(data.roomId);

      socket.to(data.roomId).emit('room:player_left', { userId: user.userId });
      io.to('lobby').emit('lobby:room_updated', { roomId: data.roomId });
    } catch (error: any) {
      socket.emit('notify:error', { code: 'ROOM_ERROR', message: error.message });
    }
  });

  // 准备/取消准备
  socket.on('room:ready', async (data: { roomId: string; ready: boolean }) => {
    try {
      await gameService.setReady(data.roomId, user.userId, data.ready);

      // 通知房间内所有玩家准备状态变更
      io.to(data.roomId).emit('room:player_ready', {
        userId: user.userId,
        ready: data.ready,
      });

      // 取消就绪时，清除该房间的倒计时
      if (!data.ready) {
        const existingTimer = countdownTimers.get(data.roomId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          countdownTimers.delete(data.roomId);
          io.to(data.roomId).emit('room:countdown_cancelled', { reason: '有玩家取消了准备' });
        }
        return;
      }

      // 如果所有玩家都准备好了，自动开始游戏倒计时
      const room = await gameService.getRoom(data.roomId);
      if (room && room.players.length >= 2 && room.players.every(p => p.ready)) {
        io.to(data.roomId).emit('room:all_ready', { countdown: 3 });

        // 清除旧定时器（如果存在）
        const oldTimer = countdownTimers.get(data.roomId);
        if (oldTimer) clearTimeout(oldTimer);

        // 3秒后自动开始游戏
        const timer = setTimeout(async () => {
          countdownTimers.delete(data.roomId);
          try {
            const updatedRoom = await gameService.getRoom(data.roomId);
            // 检查房间状态、人数、以及所有玩家是否仍然 ready
            if (updatedRoom
              && updatedRoom.status === RoomStatus.WAITING
              && updatedRoom.players.length >= 2
              && updatedRoom.players.every(p => p.ready)
            ) {
              const started = await gameService.startGame(data.roomId);
              io.to(data.roomId).emit('room:game_start', {
                roomId: started.id,
                gameType: started.gameType,
              });
              io.to('lobby').emit('lobby:room_updated', { roomId: data.roomId });
            }
          } catch (e) {
            logger.error('自动开始游戏失败:', e);
          }
        }, 3000);
        countdownTimers.set(data.roomId, timer);
      }
    } catch (error: any) {
      socket.emit('notify:error', { code: 'ROOM_ERROR', message: error.message });
    }
  });

  // 邀请好友
  socket.on('room:invite', async (data: { targetUserId: string; roomId: string; gameType: string }) => {
    try {
      const targetSockets = getUserSockets(io, data.targetUserId);
      targetSockets.forEach(s => {
        s.emit('notify:game_invite', {
          fromUser: {
            id: user.userId,
            nickname: user.nickname,
            avatar: null,
          },
          roomId: data.roomId,
          gameType: data.gameType,
        });
      });

      socket.emit('notify:info', { message: '邀请已发送' });
    } catch (error: any) {
      socket.emit('notify:error', { code: 'INVITE_ERROR', message: error.message });
    }
  });

  // 开始游戏 (房主或自动)
  socket.on('room:start_game', async (data: { roomId: string }) => {
    try {
      // 校验操作者是房主
      const room = await gameService.getRoom(data.roomId);
      if (!room) {
        socket.emit('notify:error', { code: 'ROOM_ERROR', message: '房间不存在' });
        return;
      }
      if (room.hostId !== user.userId) {
        socket.emit('notify:error', { code: 'ROOM_ERROR', message: '只有房主可以开始游戏' });
        return;
      }

      const started = await gameService.startGame(data.roomId);

      // 通知房间所有玩家游戏开始
      io.to(data.roomId).emit('room:game_start', {
        roomId: started.id,
        gameType: started.gameType,
      });

      io.to('lobby').emit('lobby:room_updated', { roomId: data.roomId });
    } catch (error: any) {
      socket.emit('notify:error', { code: 'START_ERROR', message: error.message });
    }
  });
}

function formatRoomInfo(room: any) {
  return {
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
    createdAt: room.createdAt?.toISOString(),
  };
}
