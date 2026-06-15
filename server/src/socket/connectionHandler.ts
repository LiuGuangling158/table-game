import { Server, Socket } from 'socket.io';
import { onlineUsers } from './index';

export function handleConnection(io: Server, socket: Socket): void {
  const user = (socket as any).user;

  // 通知所有在线好友: 该用户上线了
  // 实际应用中应查询好友列表再精确广播，这里先全量广播
  socket.broadcast.emit('user:online', { userId: user.userId });

  // 发送当前在线好友列表
  socket.emit('user:online_list', {
    users: Array.from(onlineUsers.keys()),
  });
}
