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
    players: 2,
  },
  {
    type: GameType.XIANGQI,
    label: '中国象棋',
    icon: '🏯',
    description: '楚河汉界，运筹帷幄',
    players: 2,
  },
  {
    type: GameType.CHESS,
    label: '国际象棋',
    icon: '♟️',
    description: '经典国际象棋对弈',
    players: 2,
  },
  {
    type: GameType.WANGBA,
    label: '抽王八',
    icon: '🐢',
    description: '配对消牌，谁拿到王八谁输！',
    players: '2-4',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { roomList, setRoomList } = useGameStore();
  const [creating, setCreating] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [playerSelectGame, setPlayerSelectGame] = useState<string | null>(null);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [selectedDrawMode, setSelectedDrawMode] = useState<string>('neighbor');
  const socket = getSocket();

  useEffect(() => {
    // 获取房间列表
    fetchRooms();

    // 监听房间列表更新
    if (socket) {
      socket.emit('lobby:get_rooms', {});

      const onRooms = (rooms: GameRoomInfo[]) => {
        setRoomList(rooms);
        setFetchState('loaded');
      };
      const onRoomUpdate = () => {
        fetchRooms();
      };

      socket.on('lobby:rooms', onRooms);
      socket.on('lobby:room_updated', onRoomUpdate);

      return () => {
        socket.off('lobby:rooms', onRooms);
        socket.off('lobby:room_updated', onRoomUpdate);
      };
    }
  }, [socket]);

  const fetchRooms = async () => {
    setFetchState(prev => prev === 'loaded' ? 'loaded' : 'loading');
    try {
      const { data } = await api.get('/games/rooms');
      if (data.success) {
        setRoomList(data.data);
        setFetchState('loaded');
      }
    } catch (err) {
      console.error('获取房间列表失败:', err);
      setFetchState(prev => prev === 'loaded' ? 'loaded' : 'error');
    }
  };

  const handleCreateRoom = async (gameType: GameType, maxPlayers: number = 2, drawMode?: string) => {
    setCreating(gameType);
    setPlayerSelectGame(null);
    try {
      // 存储抽牌模式到 gameStore 供 GamePlayPage 使用
      if (drawMode) {
        useGameStore.getState().setWangbaDrawMode(drawMode);
      }
      const { data } = await api.post('/games/rooms', { gameType, maxPlayers });
      if (data.success) {
        navigate(`/room/${data.data.id}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || '创建房间失败');
    } finally {
      setCreating(null);
    }
  };

  const handleGameClick = (gameType: GameType) => {
    // WANGBA 需要先选择玩家人数
    if (gameType === GameType.WANGBA) {
      setPlayerSelectGame(gameType);
      return;
    }
    handleCreateRoom(gameType);
  };

  const handleJoinRoom = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  const getRoomAction = (room: GameRoomInfo) => {
    const isFull = room.players.length >= room.maxPlayers;
    const isPlaying = room.status === 'PLAYING';

    if (isPlaying) {
      return { label: '观战', disabled: false, reason: '' };
    }
    if (isFull) {
      return { label: '已满', disabled: true, reason: '房间已满' };
    }
    return { label: '加入', disabled: false, reason: '' };
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
              onClick={() => handleGameClick(game.type)}
            >
              <div className="text-4xl mb-3">{game.icon}</div>
              <h3 className="text-lg font-semibold text-gray-800">{game.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{game.description}</p>
              <button
                disabled={creating === game.type}
                className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creating === game.type ? '创建中...' : game.type === GameType.WANGBA ? '选择人数创建' : '创建房间'}
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

        {fetchState === 'loading' ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border">
            <div className="text-4xl mb-3 animate-pulse">🔍</div>
            <p>加载房间列表...</p>
          </div>
        ) : fetchState === 'error' ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border">
            <div className="text-4xl mb-3">⚠️</div>
            <p>加载失败</p>
            <p className="text-sm mt-1">网络异常，请检查连接</p>
            <button onClick={fetchRooms} className="mt-3 text-blue-500 text-sm hover:underline">点击重试</button>
          </div>
        ) : roomList.length === 0 ? (
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
                      {(() => {
                        const action = getRoomAction(room);
                        return (
                          <button
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={action.disabled}
                            title={action.reason}
                            className={`text-sm ${
                              action.disabled
                                ? 'text-gray-300 cursor-not-allowed'
                                : action.label === '观战'
                                  ? 'text-yellow-600 hover:text-yellow-800'
                                  : 'text-blue-500 hover:text-blue-700'
                            }`}
                          >
                            {action.label}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 抽王八人数 + 抽牌模式选择弹窗 */}
      {playerSelectGame && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full mx-4 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">🐢</div>
              <h3 className="text-xl font-bold text-gray-800">创建抽王八房间</h3>
            </div>

            {/* 人数选择 */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-3 text-center">👥 玩家人数</p>
              <div className="grid grid-cols-3 gap-3">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSelectedPlayerCount(count)}
                    className={`py-3 rounded-xl border-2 transition-all ${
                      selectedPlayerCount === count
                        ? 'bg-amber-100 border-amber-500 text-amber-800 font-bold'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-amber-50'
                    }`}
                  >
                    <div className="text-xl">{count}人</div>
                    <div className="text-xs mt-0.5">
                      {count === 2 ? '对决' : count === 3 ? '经典' : '热闹'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 抽牌模式选择 */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-3 text-center">🎯 抽牌模式</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedDrawMode('neighbor')}
                  className={`py-4 rounded-xl border-2 transition-all text-center ${
                    selectedDrawMode === 'neighbor'
                      ? 'bg-blue-100 border-blue-500 text-blue-800 font-bold'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-lg">🔄 顺时针</div>
                  <div className="text-xs mt-1">只能从下家抽牌</div>
                </button>
                <button
                  onClick={() => setSelectedDrawMode('any')}
                  className={`py-4 rounded-xl border-2 transition-all text-center ${
                    selectedDrawMode === 'any'
                      ? 'bg-purple-100 border-purple-500 text-purple-800 font-bold'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-lg">🎲 任意抽</div>
                  <div className="text-xs mt-1">可从任意对手抽牌</div>
                </button>
              </div>
            </div>

            {/* 创建按钮 */}
            <button
              onClick={() => handleCreateRoom(playerSelectGame as GameType, selectedPlayerCount, selectedDrawMode)}
              disabled={creating === playerSelectGame}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            >
              {creating === playerSelectGame ? '创建中...' : `创建 ${selectedPlayerCount}人·${selectedDrawMode === 'neighbor' ? '顺时针' : '任意抽'} 房间`}
            </button>

            <button
              onClick={() => setPlayerSelectGame(null)}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
