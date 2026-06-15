import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { getSocket } from '../services/socket';
import GomokuBoard from '../games/gomoku/GomokuBoard';
import XiangqiBoard from '../games/xiangqi/XiangqiBoard';
import ChessBoard from '../games/chess/ChessBoard';
import { GameType } from 'shared';

export default function GamePlayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentRoom, boardState, currentPlayer, gameOver } = useGameStore();
  const { sendMove, resign, requestDraw, respondDraw, leaveRoom, initGame } = useGameRoom(roomId || '');
  const [chatMessages, setChatMessages] = useState<Array<{ userId: string; nickname: string; message: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [showDrawRequest, setShowDrawRequest] = useState(false);
  const [opponentDrawRequest, setOpponentDrawRequest] = useState(false);

  const gameType = currentRoom?.gameType;

  // 设置全局 currentRoomId 供棋盘组件使用
  useEffect(() => {
    if (roomId) {
      (window as any).__currentRoomId = roomId;
      (window as any).__socket = getSocket();
    }
  }, [roomId]);

  // 如果没有 gameType，说明是直接访问 /play/:roomId，需要请求房间信息和初始化游戏
  useEffect(() => {
    if (!roomId || !gameType) return;
    initGame(gameType);
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

    socket.on('game:chat', handleChat);
    socket.on('game:draw_request', handleDrawReq);
    socket.on('game:draw_response', handleDrawRes);

    return () => {
      socket.off('game:chat', handleChat);
      socket.off('game:draw_request', handleDrawReq);
      socket.off('game:draw_response', handleDrawRes);
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

  return (
    <div className="flex flex-col lg:flex-row gap-4 max-w-6xl mx-auto">
      {/* 棋盘区域 */}
      <div className="flex-1 flex justify-center">
        {gameType === GameType.GOMOKU && <GomokuBoard />}
        {gameType === GameType.XIANGQI && <XiangqiBoard />}
        {gameType === GameType.CHESS && <ChessBoard />}
        {!gameType && (
          <div className="text-center p-12 text-gray-400">
            <p>等待游戏开始...</p>
          </div>
        )}
      </div>

      {/* 侧边栏 */}
      <div className="w-full lg:w-72 space-y-4">
        {/* 游戏信息 */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-medium text-gray-800 mb-3">
            {gameType === GameType.GOMOKU ? '五子棋' : gameType === GameType.XIANGQI ? '中国象棋' : '国际象棋'}
          </h3>

          {gameOver ? (
            <div className="p-4 bg-yellow-50 rounded-xl text-center">
              <p className="text-lg font-bold text-yellow-700">游戏结束!</p>
              <p className="text-sm text-yellow-600 mt-1">
                {gameOver.winner
                  ? `${getPlayerColorName(gameOver.winner)} 获胜`
                  : '平局'}
              </p>
              <p className="text-xs text-yellow-500 mt-1">原因: {gameOver.reason}</p>
              <button
                onClick={() => navigate(`/room/${roomId}`)}
                className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
              >
                返回房间
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">当前回合</span>
                <span className="font-medium">{getCurrentPlayerLabel()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">步数</span>
                <span className="font-medium">{boardState?.moveCount || 0}</span>
              </div>
              {boardState?.inCheck && (
                <div className="p-2 bg-red-50 text-red-600 text-sm rounded-lg">
                  ⚠️ {getPlayerColorName(boardState.inCheck)}被将军!
                </div>
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {!gameOver && (
          <div className="bg-white rounded-xl shadow-sm border p-4 space-y-2">
            <button
              onClick={handleResign}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              🏳️ 认输
            </button>
            <button
              onClick={handleDrawRequest}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              🤝 求和
            </button>
            {opponentDrawRequest && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">对方请求和棋</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDrawResponse(true)}
                    className="flex-1 py-1.5 bg-blue-500 text-white text-sm rounded-lg"
                  >
                    同意
                  </button>
                  <button
                    onClick={() => handleDrawResponse(false)}
                    className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg"
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

        {/* 聊天 */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h4 className="font-medium text-gray-700 mb-3">聊天</h4>
          <div className="h-40 overflow-y-auto space-y-2 mb-3 bg-gray-50 rounded-lg p-2">
            {chatMessages.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">暂无消息</p>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="text-sm">
                <span className="font-medium text-gray-700">{msg.nickname}: </span>
                <span className="text-gray-600">{msg.message}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="输入消息..."
              className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleSendChat}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
