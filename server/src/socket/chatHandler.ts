import { Server, Socket } from 'socket.io';

export function handleChat(io: Server, socket: Socket): void {
  const user = (socket as any).user;

  socket.on('game:chat', (data: { roomId: string; message: string }) => {
    // 广播消息到房间内所有玩家(包括发送者)
    io.to(data.roomId).emit('game:chat', {
      userId: user.userId,
      nickname: user.nickname,
      message: data.message,
      timestamp: Date.now(),
    });
  });
}
