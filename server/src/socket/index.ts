import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { handleConnection } from './connectionHandler';
import { handleLobby } from './lobbyHandler';
import { handleGameRoom } from './gameRoomHandler';
import { handleGame, activeGames } from './gameHandler';
import { handleChat } from './chatHandler';

// 存储在线用户的 socket 映射: userId -> Set<socketId>
export const onlineUsers = new Map<string, Set<string>>();

// 存储 io 实例供路由等模块使用
let _io: Server | null = null;
export function getIO(): Server | null { return _io; }

// 存储 socketId -> userId 的映射
export const socketToUser = new Map<string, { userId: string; nickname: string }>();

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  _io = io;

  // 认证中间件
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('请先登录'));
      }

      const payload = verifyToken(token as string);
      (socket as any).user = payload;
      next();
    } catch (error) {
      next(new Error('无效的Token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`用户连接: ${user.nickname} (${user.userId})`);

    // 记录在线用户
    if (!onlineUsers.has(user.userId)) {
      onlineUsers.set(user.userId, new Set());
    }
    onlineUsers.get(user.userId)!.add(socket.id);
    socketToUser.set(socket.id, { userId: user.userId, nickname: user.nickname });

    // 各模块处理器
    handleConnection(io, socket);
    handleLobby(io, socket);
    handleGameRoom(io, socket);
    handleGame(io, socket);
    handleChat(io, socket);

    // 断线处理
    socket.on('disconnect', () => {
      logger.info(`用户断开: ${user.nickname} (${user.userId})`);

      const userSockets = onlineUsers.get(user.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(user.userId);
          // 通知好友离线
          io.emit('user:offline', { userId: user.userId });

          // 检查该用户是否在活跃游戏中，通知对手
          for (const [roomId, gameData] of activeGames) {
            const isPlayer = [...gameData.playerUsers.values()].includes(user.userId);
            if (isPlayer) {
              io.to(roomId).emit('game:player_disconnected', {
                userId: user.userId,
                nickname: user.nickname,
              });
              logger.info(`玩家断线通知: ${roomId}, 用户: ${user.userId}`);
            }
          }
        }
      }
      socketToUser.delete(socket.id);
    });
  });

  return io;
}

/** 获取用户当前在线的所有 socket */
export function getUserSockets(io: Server, userId: string): Socket[] {
  const socketIds = onlineUsers.get(userId);
  if (!socketIds) return [];

  const sockets: Socket[] = [];
  socketIds.forEach(id => {
    const socket = io.sockets.sockets.get(id);
    if (socket) {
      sockets.push(socket);
    }
  });
  return sockets;
}
