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

  useEffect(() => {
    if (!roomId || !socket) return;

    // 加入 Socket 房间
    socket.emit('room:join', { roomId });

    // 获取房间信息
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/games/rooms/${roomId}`);
        if (data.success) {
          setCurrentRoom(data.data);
        }
      } catch (err) {
        console.error('获取房间信息失败:', err);
        navigate('/');
      }
    };
    fetchRoom();

    // 监听房间事件
    socket.on('room:joined', (data: any) => {
      setCurrentRoom(data.room);
    });

    socket.on('room:player_joined', () => {
      fetchRoom();
    });

    socket.on('room:player_left', () => {
      fetchRoom();
    });

    socket.on('room:player_ready', (data: any) => {
      fetchRoom();
    });

    socket.on('room:all_ready', (data: { countdown: number }) => {
      // 清理之前的倒计时（如果有）
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
    });

    socket.on('room:game_start', (data: { roomId: string; gameType: string }) => {
      // 跳转到游戏页面（游戏初始化由 GamePlayPage 负责）
      // 清理倒计时
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      navigate(`/play/${roomId}`);
    });

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      socket.off('room:joined');
      socket.off('room:player_joined');
      socket.off('room:player_left');
      socket.off('room:player_ready');
      socket.off('room:all_ready');
      socket.off('room:game_start');
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
                  {player.avatar || (idx === 0 ? '⚫' : '⚪')}
                </div>
                <div>
                  <p className="font-medium">{player.nickname}</p>
                  <p className="text-xs text-gray-500">
                    {player.color === 'BLACK' ? '黑方' : player.color === 'WHITE' ? '白方' : player.color === 'RED' ? '红方' : '蓝方'}
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
