import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useFriendStore } from '../stores/friendStore';
import { useAuthStore } from '../stores/authStore';
import { getSocket } from '../services/socket';
import api from '../services/api';
import { GAME_TYPE_LABELS } from 'shared';

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const socket = getSocket();
  const { currentRoom, setCurrentRoom, resetGame } = useGameStore();
  const { friends } = useFriendStore();
  const user = useAuthStore((s) => s.user);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipLeaveRef = useRef(false);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!roomId || !socket) return;

    const joinRoom = () => { socket.emit('room:join', { roomId }); };
    joinRoom();

    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/games/rooms/${roomId}`);
        if (data.success) {
          setCurrentRoom(data.data);
          const me = data.data.players.find((p: any) => p.userId === user?.id);
          if (me) { hasJoinedRef.current = true; setReady(me.ready); }
        }
      } catch (err) { console.error('获取房间信息失败:', err); navigate('/'); }
    };
    fetchRoom();

    const onJoined = (data: any) => { hasJoinedRef.current = true; setCurrentRoom(data.room); };
    const onRoomUpdate = () => { fetchRoom(); };
    const onAllReady = (data: { countdown: number }) => {
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); }
      setCountdown(data.countdown);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };
    const onCountdownCancelled = () => {
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
      setCountdown(null);
    };
    const onGameStart = () => {
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
      skipLeaveRef.current = true;
      navigate(`/play/${roomId}`);
    };
    const onReconnect = () => { joinRoom(); fetchRoom(); };

    socket.on('room:joined', onJoined);
    socket.on('room:player_joined', onRoomUpdate);
    socket.on('room:player_left', onRoomUpdate);
    socket.on('room:player_ready', onRoomUpdate);
    socket.on('room:all_ready', onAllReady);
    socket.on('room:countdown_cancelled', onCountdownCancelled);
    socket.on('room:game_start', onGameStart);
    socket.on('connect', onReconnect);

    return () => {
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
      socket.off('room:joined', onJoined);
      socket.off('room:player_joined', onRoomUpdate);
      socket.off('room:player_left', onRoomUpdate);
      socket.off('room:player_ready', onRoomUpdate);
      socket.off('room:all_ready', onAllReady);
      socket.off('room:countdown_cancelled', onCountdownCancelled);
      socket.off('room:game_start', onGameStart);
      socket.off('connect', onReconnect);
      if (hasJoinedRef.current && !skipLeaveRef.current) { socket.emit('room:leave', { roomId }); }
    };
  }, [roomId, socket]);

  const handleReady = () => {
    const newReady = !ready;
    setReady(newReady);
    socket?.emit('room:ready', { roomId, ready: newReady });
  };

  const handleStartGame = () => { socket?.emit('room:start_game', { roomId }); };

  const handleInviteFriend = (friendId: string) => {
    socket?.emit('room:invite', { targetUserId: friendId, roomId, gameType: currentRoom?.gameType });
    alert('邀请已发送');
  };

  const handleLeave = () => {
    skipLeaveRef.current = true;
    socket?.emit('room:leave', { roomId });
    resetGame();
    navigate('/');
  };

  const isHost = currentRoom?.hostId === user?.id;
  const playerIcons = ['🔴', '🔵', '🟢', '🟡', '🟣'];

  return (
    <div className="page-container-sm" style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '18px' }}>
          {currentRoom ? GAME_TYPE_LABELS[currentRoom.gameType] : '房间'}
        </h2>
        <button onClick={handleLeave} className="nes-btn is-error" style={{ fontSize: '12px', padding: '4px 12px' }}>
          离开房间
        </button>
      </div>

      {/* 倒计时 */}
      {countdown !== null && (
        <div className="nes-container is-centered" style={{ marginBottom: '16px', padding: '16px 24px', borderColor: 'var(--primary-color)' }}>
          <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '14px', color: 'var(--primary-color)', marginBottom: '8px' }}>
            游戏即将开始...
          </p>
          <span style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '40px', color: 'var(--primary-color)' }}>
            {countdown}
          </span>
          <progress className="nes-progress is-primary" value={3 - countdown} max={3}
            style={{ width: '100%', marginTop: '8px' }} />
        </div>
      )}

      {/* 玩家列表 */}
      <div className="nes-container with-title" style={{ marginBottom: '16px' }}>
        <p className="title" style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px' }}>
          玩家 ({currentRoom?.players.length || 0}/{currentRoom?.maxPlayers || 2})
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {currentRoom?.players.map((player, idx) => (
            <div key={player.userId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', border: '3px solid #000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', background: '#fafafa',
                }}>
                  {player.avatar || playerIcons[idx] || '👤'}
                </div>
                <div>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', fontWeight: 'bold' }}>
                    {player.nickname}
                  </p>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>
                    {(() => {
                      const m: Record<string,string> = { BLACK:'黑方', WHITE:'白方', RED:'红方', BLUE:'蓝方', GREEN:'绿方', YELLOW:'黄方', PURPLE:'紫方' };
                      return m[player.color] || player.color;
                    })()}
                    {currentRoom.hostId === player.userId && ' (房主)'}
                  </p>
                </div>
              </div>
              <span className={`nes-badge ${player.ready ? 'is-success' : ''}`}>
                <span className={player.ready ? 'is-success' : ''}>
                  {player.ready ? '已准备' : '未准备'}
                </span>
              </span>
            </div>
          ))}
        </div>

        {currentRoom && currentRoom.players.length < currentRoom.maxPlayers && (
          <div className="nes-container is-centered" style={{ marginTop: '16px', padding: '16px' }}>
            <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>
              等待更多玩家加入...
            </p>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <button onClick={handleReady}
          className={`nes-btn ${ready ? 'is-warning' : 'is-success'}`}
          style={{ width: '100%', fontSize: '14px', padding: '12px' }}>
          {ready ? '取消准备' : '准备'}
        </button>

        {isHost && (
          <button onClick={handleStartGame}
            disabled={!currentRoom?.players.every(p => p.ready) || (currentRoom?.players.length || 0) < 2}
            className={`nes-btn is-primary ${(!currentRoom?.players.every(p => p.ready) || (currentRoom?.players.length || 0) < 2) ? 'is-disabled' : ''}`}
            style={{ width: '100%', fontSize: '14px', padding: '12px' }}>
            开始游戏
          </button>
        )}
      </div>

      {/* 邀请好友 */}
      <div className="nes-container with-title">
        <p className="title" style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '12px' }}>
          邀请好友
        </p>
        {friends.length === 0 ? (
          <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888', textAlign: 'center' }}>
            还没有好友，先去添加好友吧！
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {friends.map((friend) => (
              <div key={friend.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px' }}>
                  {friend.nickname}
                </span>
                <button
                  onClick={() => handleInviteFriend(friend.userId)}
                  disabled={friend.status === 'OFFLINE' || currentRoom?.players.some(p => p.userId === friend.userId)}
                  className={`nes-btn is-primary ${(friend.status === 'OFFLINE' || currentRoom?.players.some(p => p.userId === friend.userId)) ? 'is-disabled' : ''}`}
                  style={{ fontSize: '12px', padding: '2px 12px' }}>
                  邀请
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
