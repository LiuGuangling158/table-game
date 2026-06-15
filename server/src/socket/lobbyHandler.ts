import { Server, Socket } from 'socket.io';
import { gameService } from '../services/gameService';

export function handleLobby(io: Server, socket: Socket): void {
  // 加入大厅房间
  socket.join('lobby');

  // 获取房间列表 (客户端发起请求)
  socket.on('lobby:get_rooms', async (data: { gameType?: any }) => {
    try {
      const rooms = await gameService.getRooms(data?.gameType);
      const formattedRooms = rooms.map(r => ({
        id: r.id,
        gameType: r.gameType,
        status: r.status,
        maxPlayers: r.maxPlayers,
        hostId: r.hostId,
        players: r.players.map(p => ({
          userId: p.user.id,
          nickname: p.user.nickname,
          avatar: p.user.avatar,
          color: p.color,
          ready: p.ready,
        })),
        createdAt: r.createdAt.toISOString(),
      }));
      socket.emit('lobby:rooms', formattedRooms);
    } catch (error: any) {
      socket.emit('notify:error', { code: 'LOBBY_ERROR', message: error.message });
    }
  });
}
