import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  const token = localStorage.getItem('token');

  // 如果已有连接且 token 未变，直接返回
  if (socket?.connected && (socket as any)._authToken === token) {
    return socket;
  }

  // 断开旧连接 (token 已变更)
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // 记录当前 token 以便检测变更
  (socket as any)._authToken = token;

  socket.on('connect', () => {
    console.log('[Socket] 已连接:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] 断开:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] 连接错误:', error.message);
  });

  return socket;
}

/**
 * 更新 Socket 认证 token (Token 刷新后调用)
 */
export function refreshSocketToken(newToken: string): void {
  if (socket) {
    (socket as any)._authToken = newToken;
    // 更新已存在连接上的 auth 属性 (虽然 Socket.IO 不会自动使用它，但下一次重连时会验证)
    (socket as any).auth = { token: newToken };
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
