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
    gradient: 'from-emerald-400 to-teal-500',
    bg: 'from-emerald-50 to-teal-50',
    accent: '#10b981',
  },
  {
    type: GameType.XIANGQI,
    label: '中国象棋',
    icon: '🏯',
    description: '楚河汉界，运筹帷幄',
    players: 2,
    gradient: 'from-red-400 to-rose-500',
    bg: 'from-red-50 to-rose-50',
    accent: '#ef4444',
  },
  {
    type: GameType.CHESS,
    label: '国际象棋',
    icon: '♟️',
    description: '经典国际象棋对弈',
    players: 2,
    gradient: 'from-slate-500 to-gray-600',
    bg: 'from-slate-50 to-gray-50',
    accent: '#64748b',
  },
  {
    type: GameType.WANGBA,
    label: '抽王八',
    icon: '🐢',
    description: '配对消牌，谁拿到王八谁输！',
    players: '2-4',
    gradient: 'from-amber-400 to-orange-500',
    bg: 'from-amber-50 to-orange-50',
    accent: '#f59e0b',
  },
];

const GAME_ROOM_ICON: Record<string, string> = {
  GOMOKU: '⚫', XIANGQI: '🏯', CHESS: '♟️', WANGBA: '🐢',
};

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
    fetchRooms();

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
      return { label: '观战', disabled: false, style: 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' };
    }
    if (isFull) {
      return { label: '已满', disabled: true, style: 'text-gray-300 cursor-not-allowed' };
    }
    return { label: '加入', disabled: false, style: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' };
  };

  const getRoomStatusBadge = (room: GameRoomInfo) => {
    if (room.status === 'PLAYING') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500" />
          </span>
          游戏中
        </span>
      );
    }
    return (
      <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
        等待中
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ========== 游戏种类 ========== */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <span className="text-lg">🎮</span>
          <h2 className="text-xl font-bold text-gray-800">选择游戏</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAME_LIST.map((game) => {
            const isWangba = game.type === GameType.WANGBA;
            return (
              <div
                key={game.type}
                onClick={() => handleGameClick(game.type)}
                className="group relative bg-white rounded-2xl shadow-sm border border-gray-100
                  overflow-hidden cursor-pointer transition-all duration-300
                  hover:shadow-lg hover:-translate-y-1"
              >
                {/* 顶部色条 */}
                <div className={`h-1.5 bg-gradient-to-r ${game.gradient}`} />

                <div className="p-5">
                  {/* 图标 + 标签 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.bg}
                      flex items-center justify-center text-2xl shadow-sm`}>
                      {game.icon}
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      typeof game.players === 'string'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {typeof game.players === 'string' ? `${game.players}人` : `${game.players}人`}
                    </span>
                  </div>

                  {/* 标题 + 描述 */}
                  <h3 className="text-base font-bold text-gray-800 mb-1">{game.label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{game.description}</p>

                  {/* 按钮 */}
                  <button
                    disabled={creating === game.type}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGameClick(game.type);
                    }}
                    className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold
                      transition-all duration-200 active:scale-[0.98]
                      ${creating === game.type
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : `bg-gradient-to-r ${game.gradient} text-white shadow-md hover:shadow-lg`
                      }`}
                  >
                    {creating === game.type ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        创建中...
                      </span>
                    ) : isWangba ? '选择人数创建' : '创建房间'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========== 房间列表 ========== */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏠</span>
            <h2 className="text-xl font-bold text-gray-800">公开房间</h2>
            {roomList.length > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {roomList.length} 个
              </span>
            )}
          </div>
          <button
            onClick={fetchRooms}
            className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors
              flex items-center gap-1"
          >
            <span>🔄</span> 刷新
          </button>
        </div>

        {/* 加载中 */}
        {fetchState === 'loading' && (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">加载房间列表...</p>
          </div>
        )}

        {/* 加载失败 */}
        {fetchState === 'error' && (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-gray-600 font-semibold mb-1">加载失败</p>
            <p className="text-sm text-gray-400 mb-4">网络异常，请检查连接后重试</p>
            <button
              onClick={fetchRooms}
              className="px-6 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium
                hover:bg-blue-600 transition-colors"
            >
              点击重试
            </button>
          </div>
        )}

        {/* 空列表 */}
        {fetchState === 'loaded' && roomList.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🏠</div>
            <p className="text-gray-600 font-semibold mb-1">暂无公开房间</p>
            <p className="text-sm text-gray-400">创建一个房间，邀请好友来玩吧！</p>
          </div>
        )}

        {/* 房间列表 - 卡片式 */}
        {fetchState === 'loaded' && roomList.length > 0 && (
          <div className="space-y-2.5">
            {roomList.map((room) => {
              const action = getRoomAction(room);
              return (
                <div
                  key={room.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3.5
                    flex items-center gap-4 flex-wrap transition-all duration-200
                    hover:shadow-md hover:border-gray-200"
                >
                  {/* 游戏图标 */}
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl shrink-0">
                    {GAME_ROOM_ICON[room.gameType] || '🎮'}
                  </div>

                  {/* 游戏名 + 房主 */}
                  <div className="min-w-0 shrink-0" style={{ width: '100px' }}>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {GAME_TYPE_LABELS[room.gameType] || room.gameType}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      房主: {room.players[0]?.nickname || '-'}
                    </p>
                  </div>

                  {/* 玩家数 */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">👥</span>
                    <span className={`text-sm font-semibold ${
                      room.players.length >= room.maxPlayers ? 'text-red-500' : 'text-gray-700'
                    }`}>
                      {room.players.length}
                    </span>
                    <span className="text-xs text-gray-400">/{room.maxPlayers}</span>
                  </div>

                  {/* 状态 */}
                  <div className="shrink-0">
                    {getRoomStatusBadge(room)}
                  </div>

                  {/* 占位 */}
                  <div className="flex-1 min-w-0" />

                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={action.disabled}
                    className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold
                      transition-all duration-200 active:scale-95
                      ${action.style}`}
                  >
                    {action.label}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========== 抽王八创建弹窗 ========== */}
      {playerSelectGame && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setPlayerSelectGame(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 space-y-5 animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100
                flex items-center justify-center text-4xl shadow-sm">
                🐢
              </div>
              <h3 className="text-xl font-extrabold text-gray-800">创建抽王八房间</h3>
              <p className="text-xs text-gray-400 mt-1">选择玩家人数和抽牌模式</p>
            </div>

            {/* 人数选择 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wide text-center">
                👥 玩家人数
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSelectedPlayerCount(count)}
                    className={`py-3 rounded-xl border-2 transition-all duration-200 ${
                      selectedPlayerCount === count
                        ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm'
                        : 'bg-gray-50 border-gray-150 text-gray-500 hover:bg-amber-50/50 hover:border-amber-200'
                    }`}
                  >
                    <div className="text-xl font-bold">{count}人</div>
                    <div className="text-[10px] mt-0.5 opacity-70">
                      {count === 2 ? '对决' : count === 3 ? '经典' : '热闹'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 抽牌模式选择 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wide text-center">
                🎯 抽牌模式
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setSelectedDrawMode('neighbor')}
                  className={`py-3.5 rounded-xl border-2 transition-all duration-200 ${
                    selectedDrawMode === 'neighbor'
                      ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm'
                      : 'bg-gray-50 border-gray-150 text-gray-500 hover:bg-blue-50/50 hover:border-blue-200'
                  }`}
                >
                  <div className="text-base font-bold">🔄 顺时针</div>
                  <div className="text-[10px] mt-0.5 opacity-70">只能从下家抽牌</div>
                </button>
                <button
                  onClick={() => setSelectedDrawMode('any')}
                  className={`py-3.5 rounded-xl border-2 transition-all duration-200 ${
                    selectedDrawMode === 'any'
                      ? 'bg-purple-50 border-purple-400 text-purple-800 shadow-sm'
                      : 'bg-gray-50 border-gray-150 text-gray-500 hover:bg-purple-50/50 hover:border-purple-200'
                  }`}
                >
                  <div className="text-base font-bold">🎲 任意抽</div>
                  <div className="text-[10px] mt-0.5 opacity-70">可从任意对手抽牌</div>
                </button>
              </div>
            </div>

            {/* 创建按钮 */}
            <button
              onClick={() => handleCreateRoom(playerSelectGame as GameType, selectedPlayerCount, selectedDrawMode)}
              disabled={creating === playerSelectGame}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500
                hover:to-orange-600 text-white rounded-xl font-bold text-sm
                shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300
                transition-all duration-200 active:scale-[0.98] disabled:opacity-50
                disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating === playerSelectGame ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  创建中...
                </>
              ) : (
                `创建 ${selectedPlayerCount}人 · ${selectedDrawMode === 'neighbor' ? '🔄顺时针' : '🎲任意抽'} 房间`
              )}
            </button>

            <button
              onClick={() => setPlayerSelectGame(null)}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
