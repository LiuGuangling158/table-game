import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/socket';
import api from '../services/api';
import { GameType, GAME_TYPE_LABELS, GameRoomInfo } from 'shared';

const GAME_LIST = [
  { type: GameType.GOMOKU, label: '五子棋', icon: '⚫', description: '经典五子连珠，简单易上手', players: 2, accent: 'var(--accent-gomoku)' },
  { type: GameType.XIANGQI, label: '中国象棋', icon: '🏯', description: '楚河汉界，运筹帷幄', players: 2, accent: 'var(--accent-xiangqi)' },
  { type: GameType.CHESS, label: '国际象棋', icon: '♟️', description: '经典国际象棋对弈', players: 2, accent: 'var(--accent-chess)' },
  { type: GameType.WANGBA, label: '抽王八', icon: '🐢', description: '配对消牌，谁拿到王八谁输！', players: '2-4', accent: 'var(--accent-wangba)' },
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
      const onRooms = (rooms: GameRoomInfo[]) => { setRoomList(rooms); setFetchState('loaded'); };
      const onRoomUpdate = () => { fetchRooms(); };
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
      if (data.success) { setRoomList(data.data); setFetchState('loaded'); }
    } catch (err) {
      console.error('获取房间列表失败:', err);
      setFetchState(prev => prev === 'loaded' ? 'loaded' : 'error');
    }
  };

  const handleCreateRoom = async (gameType: GameType, maxPlayers: number = 2, drawMode?: string) => {
    setCreating(gameType);
    setPlayerSelectGame(null);
    try {
      if (drawMode) { useGameStore.getState().setWangbaDrawMode(drawMode); }
      const { data } = await api.post('/games/rooms', { gameType, maxPlayers });
      if (data.success) { navigate(`/room/${data.data.id}`); }
    } catch (err: any) {
      alert(err.response?.data?.message || '创建房间失败');
    } finally {
      setCreating(null);
    }
  };

  const handleGameClick = (gameType: GameType) => {
    if (gameType === GameType.WANGBA) { setPlayerSelectGame(gameType); return; }
    handleCreateRoom(gameType);
  };

  const handleJoinRoom = (roomId: string) => { navigate(`/room/${roomId}`); };

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px', color: 'var(--text-color)',
  };

  return (
    <div style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>

      {/* ===== 游戏种类 ===== */}
      <section className="section-spacing">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px' }}>🎮</span>
          <h2 style={sectionTitleStyle}>选择游戏</h2>
        </div>

        <div className="nes-grid-4">
          {GAME_LIST.map((game) => {
            const isWangba = game.type === GameType.WANGBA;
            return (
              <div key={game.type} onClick={() => handleGameClick(game.type)}
                style={{
                  background: '#fff', cursor: 'pointer', border: '4px solid #000',
                  position: 'relative', padding: '20px', textAlign: 'center',
                  transition: 'transform 0.1s steps(1)',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {/* 顶部色条 */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: game.accent }} />

                {/* 图标 */}
                <div style={{
                  width: '56px', height: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', border: '3px solid #000', marginBottom: '12px', background: '#fafafa',
                }}>
                  {game.icon}
                </div>

                {/* 标题 + 描述 */}
                <h3 style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '15px', marginBottom: '6px' }}>
                  {game.label}
                </h3>
                <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888', lineHeight: '1.5', marginBottom: '16px' }}>
                  {game.description}
                </p>

                {/* 创建按钮 */}
                <button
                  disabled={creating === game.type}
                  onClick={(e) => { e.stopPropagation(); handleGameClick(game.type); }}
                  className={`nes-btn ${creating === game.type ? 'is-disabled' : isWangba ? 'is-warning' : 'is-primary'}`}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  {creating === game.type ? '创建中...' : isWangba ? '选择人数创建' : '创建房间'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== 房间列表 ===== */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🏠</span>
            <h2 style={sectionTitleStyle}>公开房间</h2>
            {roomList.length > 0 && (
              <span className="nes-badge" style={{ marginLeft: '8px' }}>
                <span className="is-primary">{roomList.length}</span>
              </span>
            )}
          </div>
          <button onClick={fetchRooms} className="nes-btn" style={{ fontSize: '13px', padding: '4px 12px' }}>
            🔄 刷新
          </button>
        </div>

        {/* 加载中 */}
        {fetchState === 'loading' && (
          <div className="nes-container is-centered" style={{ padding: '48px' }}>
            <i className="nes-pokeball" style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px' }}>
              加载房间列表...
            </p>
          </div>
        )}

        {/* 加载失败 */}
        {fetchState === 'error' && (
          <div className="nes-container is-centered" style={{ padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', marginBottom: '12px' }}>
              加载失败，请检查网络连接后重试
            </p>
            <button onClick={fetchRooms} className="nes-btn is-primary" style={{ fontSize: '13px' }}>
              点击重试
            </button>
          </div>
        )}

        {/* 空列表 */}
        {fetchState === 'loaded' && roomList.length === 0 && (
          <div className="nes-container is-centered" style={{ padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏠</div>
            <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px' }}>
              暂无公开房间，创建一个房间吧！
            </p>
          </div>
        )}

        {/* 房间列表 */}
        {fetchState === 'loaded' && roomList.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roomList.map((room) => {
              const isFull = room.players.length >= room.maxPlayers;
              const isPlaying = room.status === 'PLAYING';
              return (
                <div key={room.id} className="nes-container"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                    padding: '12px 16px',
                  }}>
                  {/* 游戏图标 */}
                  <span style={{ fontSize: '24px' }}>{GAME_ROOM_ICON[room.gameType] || '🎮'}</span>

                  {/* 游戏名 + 房主 */}
                  <div style={{ minWidth: '0', width: '120px' }}>
                    <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {GAME_TYPE_LABELS[room.gameType] || room.gameType}
                    </p>
                    <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>
                      房主: {room.players[0]?.nickname || '-'}
                    </p>
                  </div>

                  {/* 玩家数 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <span>👥</span>
                    <span style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", color: isFull ? 'var(--error-color)' : 'var(--text-color)' }}>
                      {room.players.length}
                    </span>
                    <span style={{ color: '#888' }}>/{room.maxPlayers}</span>
                  </div>

                  {/* 状态 */}
                  <span className={`nes-badge ${isPlaying ? '' : 'is-success'}`}>
                    <span className={isPlaying ? 'is-warning' : 'is-success'}>
                      {isPlaying ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="animate-pixel-blink" style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--warning-color)' }} />
                          游戏中
                        </span>
                      ) : '等待中'}
                    </span>
                  </span>

                  <div style={{ flex: 1, minWidth: '0' }} />

                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={isFull && !isPlaying}
                    className={`nes-btn ${isFull && !isPlaying ? 'is-disabled' : isPlaying ? 'is-warning' : 'is-primary'}`}
                    style={{ fontSize: '13px', padding: '4px 16px' }}
                  >
                    {isPlaying ? '观战' : isFull ? '已满' : '加入'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 抽王八创建弹窗 ===== */}
      {playerSelectGame && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}
        onClick={() => setPlayerSelectGame(null)}>
          <div className="nes-dialog" style={{ maxWidth: '380px', width: '100%', margin: '16px' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🐢</div>
              <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px' }}>创建抽王八房间</p>
              <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888', marginTop: '4px' }}>
                选择玩家人数和抽牌模式
              </p>
            </div>

            {/* 人数选择 */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>
                👥 玩家人数
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {[2, 3, 4].map((count) => (
                  <button key={count}
                    onClick={() => setSelectedPlayerCount(count)}
                    className={`nes-btn ${selectedPlayerCount === count ? 'is-primary' : ''}`}
                    style={{ fontSize: '13px', padding: '8px 20px' }}
                  >
                    {count}人
                  </button>
                ))}
              </div>
            </div>

            {/* 抽牌模式 */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>
                🎯 抽牌模式
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button
                  onClick={() => setSelectedDrawMode('neighbor')}
                  className={`nes-btn ${selectedDrawMode === 'neighbor' ? 'is-primary' : ''}`}
                  style={{ fontSize: '12px', padding: '8px 12px' }}
                >
                  🔄 顺时针
                </button>
                <button
                  onClick={() => setSelectedDrawMode('any')}
                  className={`nes-btn ${selectedDrawMode === 'any' ? 'is-primary' : ''}`}
                  style={{ fontSize: '12px', padding: '8px 12px' }}
                >
                  🎲 任意抽
                </button>
              </div>
            </div>

            {/* 创建按钮 */}
            <button
              onClick={() => handleCreateRoom(playerSelectGame as GameType, selectedPlayerCount, selectedDrawMode)}
              disabled={creating === playerSelectGame}
              className={`nes-btn is-warning ${creating === playerSelectGame ? 'is-disabled' : ''}`}
              style={{ width: '100%', marginBottom: '10px', fontSize: '14px' }}
            >
              {creating === playerSelectGame ? '创建中...' :
                `创建 ${selectedPlayerCount}人 · ${selectedDrawMode === 'neighbor' ? '顺时针' : '任意抽'} 房间`}
            </button>

            <button onClick={() => setPlayerSelectGame(null)}
              className="nes-btn" style={{ width: '100%', fontSize: '13px' }}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
