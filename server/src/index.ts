import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { initSocket } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { gameService } from './services/gameService';

// 路由
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import friendRoutes from './routes/friend';
import gameRoutes from './routes/game';
import historyRoutes from './routes/history';

const app = express();
const server = http.createServer(app);

// 中间件
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Table Games Server is running', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/history', historyRoutes);

// 错误处理
app.use(errorHandler);

// 初始化 Socket.IO
const io = initSocket(server);

// 启动服务器
async function startServer() {
  // 清理上次服务器会话遗留的僵尸 WAITING 房间
  await gameService.cleanupStaleRooms();

  server.listen(config.port, () => {
    logger.info(`==================================`);
    logger.info(`  Table Games Server 已启动`);
    logger.info(`  HTTP:  http://localhost:${config.port}`);
    logger.info(`  WS:    ws://localhost:${config.port}`);
    logger.info(`  环境:  ${process.env.NODE_ENV || 'development'}`);
    logger.info(`==================================`);
  });
}

startServer();

// 优雅关闭
async function gracefulShutdown(signal: string) {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

  // 通知所有活跃游戏中的玩家并保存游戏记录
  const { activeGames, activeWangbaGames } = require('./socket/gameHandler');
  const { gameService } = require('./services/gameService');
  for (const [roomId, gameData] of activeGames) {
    io.to(roomId).emit('notify:info', {
      message: '服务器正在维护，游戏即将中断',
    });
    io.to(roomId).emit('game:over', {
      winner: null,
      reason: 'DISCONNECT',
      finalState: gameData.state,
    });

    // 持久化游戏记录 (Bug 34: 防止记录丢失)
    try {
      await gameService.endGame(roomId, null, 'DISCONNECT');
      logger.info(`游戏记录已保存: ${roomId}`);
    } catch (e) {
      logger.error(`保存游戏记录失败: ${roomId}`, e);
    }
  }

  // 清理抽王八游戏
  for (const [roomId] of activeWangbaGames) {
    io.to(roomId).emit('notify:info', {
      message: '服务器正在维护，游戏即将中断',
    });
    io.to(roomId).emit('game:over', {
      winner: null,
      reason: 'DISCONNECT',
    });
    try {
      await gameService.endGame(roomId, null, 'DISCONNECT');
      logger.info(`抽王八游戏记录已保存: ${roomId}`);
    } catch (e) {
      logger.error(`保存抽王八游戏记录失败: ${roomId}`, e);
    }
  }

  // 关闭 HTTP 服务器 (停止接受新连接)
  server.close(() => {
    logger.info('HTTP 服务器已关闭');
  });

  // 关闭 Socket.IO
  io.close(() => {
    logger.info('Socket.IO 已关闭');
  });

  // 给正在处理中的请求一些时间完成
  setTimeout(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  }, 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server, io };
