import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/socket';
import api from '../services/api';
import { GameType, GAME_TYPE_LABELS, GAME_TYPE_CONFIGS, GameRoomInfo } from 'shared';

const GAME_LIST = [
  {
    type: GameType.GOMOKU,
    label: '五子棋',
    icon: '⚫',
    description: '经典五子连珠，简单易上手',
  },
  {
    type: GameType.XIANGQI,
    label: '中国象棋',
    icon: '🏯',
    description: '楚河汉界，运筹帷幄',
  },
  {
    type: GameType.CHESS,
    label: '国际象棋',
    icon: '♟️',
    description: '经典国际象棋对弈',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { roomList, setRoomList } = useGameStore();
  const [creating, setCreating] = useState<string | null>(null);
  const socket = getSocket();

  useEffect(() => {
    // 获取房间列表
    fetchRooms();

    // 监听房间列表更新
    if (socket) {
      socket.emit('lobby:get_rooms', {});
      socket.on('lobby:rooms', (rooms: GameRoomInfo[]) => {
        setRoomList(rooms);
      });
      socket.on('lobby:room_created', () => {
        fetchRooms();
      });
      socket.on('lobby:room_closed', () => {
        fetchRooms();
      });

      return () => {
        socket.off('lobby:rooms');
        socket.off('lobby:room_created');
        socket.off('lobby:room_closed');
      };
    }
  }, [socket]);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/games/rooms');
      if (data.success) {
        setRoomList(data.data);
      }
    } catch (err) {
      console.error('获取房间列表失败:', err);
    }
  };

  const handleCreateRoom = async (gameType: GameType) => {
    setCreating(gameType);
    try {
      const { data } = await api.post('/games/rooms', { gameType });
      if (data.success) {
        navigate(`/room/${data.data.id}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || '创建房间失败');
    } finally {
      setCreating(null);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  const getRoomStatusBadge = (room: GameRoomInfo) => {
    if (room.status === 'PLAYING') {
      return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">游戏中</span>;
    }
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">等待中</span>;
  };

  return (
    <div className="space-y-8">
      {/* 游戏种类 */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4">选择游戏</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {GAME_LIST.map((game) => (
            <div
              key={game.type}
              className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleCreateRoom(game.type)}
            >
              <div className="text-4xl mb-3">{game.icon}</div>
              <h3 className="text-lg font-semibold text-gray-800">{game.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{game.description}</p>
              <button
                disabled={creating === game.type}
                className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creating === game.type ? '创建中...' : '创建房间'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 房间列表 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">公开房间</h2>
          <button
            onClick={fetchRooms}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            刷新
          </button>
        </div>

        {roomList.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border">
            <div className="text-4xl mb-3">🏠</div>
            <p>暂无公开房间</p>
            <p className="text-sm mt-1">创建一个房间，邀请好友来玩吧！</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-sm text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">游戏</th>
                  <th className="px-4 py-3 font-medium">房主</th>
                  <th className="px-4 py-3 font-medium">玩家</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roomList.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        {GAME_TYPE_LABELS[room.gameType] || room.gameType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {room.players[0]?.nickname || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {room.players.length}/{room.maxPlayers}
                    </td>
                    <td className="px-4 py-3">
                      {getRoomStatusBadge(room)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleJoinRoom(room.id)}
                        disabled={room.status === 'PLAYING' && room.players.length >= room.maxPlayers}
                        className="text-sm text-blue-500 hover:text-blue-700 disabled:text-gray-300"
                      >
                        {room.status === 'PLAYING' ? '观战' : '加入'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
