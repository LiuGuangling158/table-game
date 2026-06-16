import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { getSocket } from '../services/socket';
import GomokuBoard from '../games/gomoku/GomokuBoard';
import XiangqiBoard from '../games/xiangqi/XiangqiBoard';
import ChessBoard from '../games/chess/ChessBoard';
import WangbaBoard from '../games/wangba/WangbaBoard';
import { GameType } from 'shared';

const BOARD_GAMES = [GameType.GOMOKU, GameType.XIANGQI, GameType.CHESS];

export default function GamePlayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentRoom, boardState, currentPlayer, gameOver, wangbaDrawMode } = useGameStore();
  const { sendMove, resign, requestDraw, respondDraw, leaveRoom, initGame } = useGameRoom(roomId || '');
  const [chatMessages, setChatMessages] = useState<Array<{ userId: string; nickname: string; message: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [showDrawRequest, setShowDrawRequest] = useState(false);
  const [opponentDrawRequest, setOpponentDrawRequest] = useState(false);
  const [wangbaResult, setWangbaResult] = useState<{ loserId: string; winnerIds: string[] } | null>(null);
  // 标记：返回房间时跳过 cleanup 中的 room:leave
  const skipLeaveRef = useRef(false);
  // 标记：是否已进入游戏 (防止 StrictMode 双重挂载误发 room:leave)
  const hasJoinedRef = useRef(false);

  const gameType = currentRoom?.gameType;
  const isBoardGame = gameType ? BOARD_GAMES.includes(gameType) : true;
  const isWangba = gameType === GameType.WANGBA;

  // 设置全局 currentRoomId 供棋盘组件使用 + 标记已进入游戏
  useEffect(() => {
    if (roomId) {
      (window as any).__currentRoomId = roomId;
      (window as any).__socket = getSocket();
      hasJoinedRef.current = true;
    }
  }, [roomId]);

  // 初始化游戏
  useEffect(() => {
    if (!roomId || !gameType) return;
    initGame(gameType, wangbaDrawMode);
  }, [roomId, gameType]);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) return;

    const handleChat = (data: any) => {
      setChatMessages((prev) => [...prev, data]);
    };
    const handleDrawReq = () => setOpponentDrawRequest(true);
    const handleDrawRes = (data: { accept: boolean }) => {
      if (!data.accept) alert('对方拒绝了求和');
      setShowDrawRequest(false);
    };
    const handlePlayerDisconnected = (data: { userId: string; nickname: string }) => {
      alert(`${data.nickname} 已断开连接，等待重连...`);
    };
    const handleGameOverWangba = (data: any) => {
      if (data.loserId) {
        setWangbaResult({ loserId: data.loserId, winnerIds: data.winnerIds || [] });
      }
    };

    socket.on('game:chat', handleChat);
    socket.on('game:draw_request', handleDrawReq);
    socket.on('game:draw_response', handleDrawRes);
    socket.on('game:player_disconnected', handlePlayerDisconnected);
    socket.on('game:over', handleGameOverWangba);

    return () => {
      socket.off('game:chat', handleChat);
      socket.off('game:draw_request', handleDrawReq);
      socket.off('game:draw_response', handleDrawRes);
      socket.off('game:player_disconnected', handlePlayerDisconnected);
      socket.off('game:over', handleGameOverWangba);

      // 离开游戏页面即离开房间 (需已确认进入 + 返回房间跳转除外)
      if (hasJoinedRef.current && !skipLeaveRef.current) {
        socket.emit('room:leave', { roomId });
      }
    };
  }, [roomId]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const socket = (window as any).__socket;
    socket?.emit('game:chat', { roomId, message: chatInput });
    setChatInput('');
  };

  const handleResign = () => {
    if (confirm('确定要认输吗？')) {
      resign();
    }
  };

  const handleDrawRequest = () => {
    setShowDrawRequest(true);
    requestDraw();
  };

  const handleDrawResponse = (accept: boolean) => {
    respondDraw(accept);
    setOpponentDrawRequest(false);
  };

  const getPlayerColorName = (color: string) => {
    switch (color) {
      case 'BLACK': return '黑方';
      case 'WHITE': return '白方';
      case 'RED': return '红方';
      case 'BLUE': return '蓝方';
      default: return color;
    }
  };

  const getCurrentPlayerLabel = () => {
    if (!currentPlayer) return '';
    return getPlayerColorName(currentPlayer);
  };

  const gameFinished = !!(gameOver || wangbaResult);

  return (
    <div className="flex flex-col lg:flex-row gap-5 max-w-6xl mx-auto">
      {/* 棋盘 / 游戏区域 */}
      <div className="flex-1 flex justify-center min-w-0">
        {gameType === GameType.GOMOKU && <GomokuBoard />}
        {gameType === GameType.XIANGQI && <XiangqiBoard />}
        {gameType === GameType.CHESS && <ChessBoard />}
        {gameType === GameType.WANGBA && <WangbaBoard />}
        {!gameType && (
          <div className="text-center p-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">等待游戏开始...</p>
          </div>
        )}
      </div>

      {/* 侧边栏 */}
      <div className="w-full lg:w-72 shrink-0 space-y-4">
        {/* ===== 游戏信息面板 ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 标题栏 */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
              <span>
                {gameType === GameType.GOMOKU ? '⚫' :
                 gameType === GameType.XIANGQI ? '🏯' :
                 gameType === GameType.CHESS ? '♟️' :
                 gameType === GameType.WANGBA ? '🐢' : '🎮'}
              </span>
              {gameType === GameType.GOMOKU ? '五子棋' :
               gameType === GameType.XIANGQI ? '中国象棋' :
               gameType === GameType.CHESS ? '国际象棋' :
               gameType === GameType.WANGBA ? '抽王八' : '游戏'}
            </h3>
          </div>

          <div className="p-4">
            {gameFinished ? (
              /* 游戏结束 */
              <div className="text-center py-2">
                <div className="text-3xl mb-2">
                  {wangbaResult ? '🐢' : (gameOver?.winner ? '🏆' : '🤝')}
                </div>
                <p className="text-base font-extrabold text-gray-800 mb-1">游戏结束!</p>

                {wangbaResult ? (
                  <div className="space-y-1.5">
                    <p className="text-sm">
                      <span className="text-gray-500">🐢 王八: </span>
                      <span className="font-semibold text-red-500">
                        {currentRoom?.players.find(p => p.userId === wangbaResult.loserId)?.nickname || '?'}
                      </span>
                    </p>
                    <div className="flex flex-wrap justify-center gap-1">
                      {wangbaResult.winnerIds.map((id, i) => (
                        <span key={id} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                          {currentRoom?.players.find(p => p.userId === id)?.nickname || '?'}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      {gameOver?.winner
                        ? `${getPlayerColorName(gameOver.winner)} 获胜`
                        : '平局'}
                    </p>
                    <p className="text-xs text-gray-400">原因: {gameOver?.reason}</p>
                  </div>
                )}

                <button
                  onClick={() => { skipLeaveRef.current = true; navigate(`/room/${roomId}`); }}
                  className="mt-3 w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500
                    text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200
                    hover:shadow-lg hover:from-blue-600 hover:to-indigo-600
                    transition-all duration-200 active:scale-[0.98]"
                >
                  返回房间
                </button>
              </div>
            ) : (
              /* 游戏进行中 */
              <div className="space-y-3">
                {isBoardGame && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">当前回合</span>
                      <span className="font-semibold text-gray-700">{getCurrentPlayerLabel()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">步数</span>
                      <span className="font-semibold text-gray-700">{boardState?.moveCount || 0}</span>
                    </div>
                    {boardState?.inCheck && (
                      <div className="p-2.5 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 font-medium">
                        ⚠️ {getPlayerColorName(boardState.inCheck)}被将军!
                      </div>
                    )}
                  </>
                )}

                {isWangba && (
                  <div className="text-sm text-gray-500 text-center py-1">
                    <p>游戏详情请查看左侧面板</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== 操作按钮 (仅棋盘游戏) ===== */}
        {!gameFinished && isBoardGame && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 space-y-2">
            <button
              onClick={handleResign}
              className="w-full py-2.5 bg-gray-50 text-gray-600 rounded-xl text-sm font-medium
                hover:bg-red-50 hover:text-red-600 transition-all duration-200 active:scale-[0.98]"
            >
              🏳️ 认输
            </button>
            <button
              onClick={handleDrawRequest}
              className="w-full py-2.5 bg-gray-50 text-gray-600 rounded-xl text-sm font-medium
                hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 active:scale-[0.98]"
            >
              🤝 求和
            </button>
            {opponentDrawRequest && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-700 font-medium mb-2">对方请求和棋</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDrawResponse(true)}
                    className="flex-1 py-1.5 bg-blue-500 text-white text-sm rounded-lg font-medium
                      hover:bg-blue-600 transition-colors"
                  >
                    同意
                  </button>
                  <button
                    onClick={() => handleDrawResponse(false)}
                    className="flex-1 py-1.5 bg-white text-gray-600 text-sm rounded-lg font-medium
                      border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            )}
            {showDrawRequest && (
              <p className="text-xs text-gray-400 text-center">已发送求和请求...</p>
            )}
          </div>
        )}

        {/* ===== 聊天面板 ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h4 className="font-bold text-gray-700 text-sm">💬 聊天</h4>
          </div>

          {/* 消息列表 */}
          <div className="h-44 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
            {chatMessages.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">暂无消息，来发一条吧</p>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="text-sm leading-relaxed">
                <span className="font-semibold text-gray-700">{msg.nickname}</span>
                <span className="text-gray-400 mx-1">:</span>
                <span className="text-gray-600">{msg.message}</span>
              </div>
            ))}
          </div>

          {/* 输入框 */}
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="输入消息..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                placeholder:text-gray-300 transition-all"
            />
            <button
              onClick={handleSendChat}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl
                hover:bg-blue-600 transition-colors active:scale-95 shrink-0"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
