import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { initSocket } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

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
server.listen(config.port, () => {
  logger.info(`==================================`);
  logger.info(`  Table Games Server 已启动`);
  logger.info(`  HTTP:  http://localhost:${config.port}`);
  logger.info(`  WS:    ws://localhost:${config.port}`);
  logger.info(`  环境:  ${process.env.NODE_ENV || 'development'}`);
  logger.info(`==================================`);
});

export { app, server, io };
