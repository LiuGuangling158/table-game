import { Server, Socket } from 'socket.io';

// 从 gameHandler 导入 activeGames 以校验聊天权限
import { activeGames } from './gameHandler';

export function handleChat(io: Server, socket: Socket): void {
  const user = (socket as any).user;

  socket.on('game:chat', (data: { roomId: string; message: string }) => {
    // 校验消息内容
    const trimmed = (data.message || '').trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      socket.emit('notify:error', { code: 'CHAT_ERROR', message: '消息不能超过500字' });
      return;
    }

    // 校验发送者是否为房间参与者
    const gameData = activeGames.get(data.roomId);
    if (gameData) {
      const isPlayer = [...gameData.playerUsers.values()].includes(user.userId);
      if (!isPlayer) {
        socket.emit('notify:error', { code: 'CHAT_ERROR', message: '你不是游戏参与者，无法发送消息' });
        return;
      }
    }

    // 广播消息到房间内所有玩家(包括发送者)
    io.to(data.roomId).emit('game:chat', {
      userId: user.userId,
      nickname: user.nickname,
      message: trimmed,
      timestamp: Date.now(),
    });
  });
}
