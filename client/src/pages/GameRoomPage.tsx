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
  // 标记：游戏开始跳转时跳过 cleanup 中的 room:leave
  const skipLeaveRef = useRef(false);
  // 标记：是否已确认加入房间 (防止 StrictMode 双重挂载时误发 room:leave)
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!roomId || !socket) return;

    // 加入 Socket 房间
    const joinRoom = () => {
      socket.emit('room:join', { roomId });
    };
    joinRoom();

    // 获取房间信息并同步本地状态
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/games/rooms/${roomId}`);
        if (data.success) {
          setCurrentRoom(data.data);
          // 同步服务端的 ready 状态到本地
          const me = data.data.players.find((p: any) => p.userId === user?.id);
          if (me) {
            hasJoinedRef.current = true;
            setReady(me.ready);
          }
        }
      } catch (err) {
        console.error('获取房间信息失败:', err);
        navigate('/');
      }
    };
    fetchRoom();

    // 监听房间事件 — 使用命名函数引用以支持精确移除
    const onJoined = (data: any) => {
      hasJoinedRef.current = true;
      setCurrentRoom(data.room);
    };
    const onRoomUpdate = () => {
      fetchRoom();
    };
    const onAllReady = (data: { countdown: number }) => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      setCountdown(data.countdown);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };
    const onCountdownCancelled = () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
    };
    const onGameStart = (data: { roomId: string; gameType: string }) => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      skipLeaveRef.current = true;
      navigate(`/play/${roomId}`);
    };

    // Bug 35: Socket 重连时重新加入房间
    const onReconnect = () => {
      joinRoom();
      fetchRoom();
    };

    socket.on('room:joined', onJoined);
    socket.on('room:player_joined', onRoomUpdate);
    socket.on('room:player_left', onRoomUpdate);
    socket.on('room:player_ready', onRoomUpdate);
    socket.on('room:all_ready', onAllReady);
    socket.on('room:countdown_cancelled', onCountdownCancelled);
    socket.on('room:game_start', onGameStart);
    socket.on('connect', onReconnect);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      socket.off('room:joined', onJoined);
      socket.off('room:player_joined', onRoomUpdate);
      socket.off('room:player_left', onRoomUpdate);
      socket.off('room:player_ready', onRoomUpdate);
      socket.off('room:all_ready', onAllReady);
      socket.off('room:countdown_cancelled', onCountdownCancelled);
      socket.off('room:game_start', onGameStart);
      socket.off('connect', onReconnect);

      // 离开页面即离开房间 (需已确认加入 + 游戏开始跳转除外)
      if (hasJoinedRef.current && !skipLeaveRef.current) {
        socket.emit('room:leave', { roomId });
      }
    };
  }, [roomId, socket]);

  const handleReady = () => {
    const newReady = !ready;
    setReady(newReady);
    socket?.emit('room:ready', { roomId, ready: newReady });
  };

  const handleStartGame = () => {
    socket?.emit('room:start_game', { roomId });
  };

  const handleInviteFriend = (friendId: string) => {
    socket?.emit('room:invite', {
      targetUserId: friendId,
      roomId,
      gameType: currentRoom?.gameType,
    });
    alert('邀请已发送');
  };

  const handleLeave = () => {
    skipLeaveRef.current = true;
    socket?.emit('room:leave', { roomId });
    resetGame();
    navigate('/');
  };

  const isHost = currentRoom?.hostId === user?.id;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          {currentRoom ? GAME_TYPE_LABELS[currentRoom.gameType] : '房间'}
        </h2>
        <button
          onClick={handleLeave}
          className="text-sm text-gray-500 hover:text-red-500"
        >
          离开房间
        </button>
      </div>

      {/* 倒计时 */}
      {countdown !== null && (
        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-xl text-center font-bold text-lg">
          游戏即将开始... {countdown}
        </div>
      )}

      {/* 玩家列表 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-medium text-gray-700 mb-4">
          玩家 ({currentRoom?.players.length || 0}/{currentRoom?.maxPlayers || 2})
        </h3>
        <div className="space-y-3">
          {currentRoom?.players.map((player, idx) => (
            <div key={player.userId} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                  {player.avatar || (() => {
                    const icons = ['🔴', '🔵', '🟢', '🟡', '🟣'];
                    return icons[idx] || '👤';
                  })()}
                </div>
                <div>
                  <p className="font-medium">{player.nickname}</p>
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const labelMap: Record<string, string> = {
                        BLACK: '黑方', WHITE: '白方', RED: '红方', BLUE: '蓝方',
                        GREEN: '绿方', YELLOW: '黄方', PURPLE: '紫方',
                      };
                      return labelMap[player.color] || player.color;
                    })()}
                    {currentRoom.hostId === player.userId && ' (房主)'}
                  </p>
                </div>
              </div>
              <span className={`text-sm px-2 py-1 rounded-full ${
                player.ready ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {player.ready ? '已准备' : '未准备'}
              </span>
            </div>
          ))}
        </div>

        {currentRoom && currentRoom.players.length < currentRoom.maxPlayers && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center text-gray-400 text-sm">
            等待更多玩家加入...
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="space-y-3">
        <button
          onClick={handleReady}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-colors ${
            ready
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {ready ? '取消准备' : '准备'}
        </button>

        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={!currentRoom?.players.every(p => p.ready) || (currentRoom?.players.length || 0) < 2}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始游戏
          </button>
        )}
      </div>

      {/* 邀请好友 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-medium text-gray-700 mb-3">邀请好友</h3>
        {friends.length === 0 ? (
          <p className="text-sm text-gray-400">还没有好友，先去添加好友吧！</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {friends.map((friend) => (
              <div key={friend.userId} className="flex items-center justify-between py-1">
                <span className="text-sm">{friend.nickname}</span>
                <button
                  onClick={() => handleInviteFriend(friend.userId)}
                  disabled={friend.status === 'OFFLINE' || currentRoom?.players.some(p => p.userId === friend.userId)}
                  className="text-xs px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 disabled:opacity-30"
                >
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
