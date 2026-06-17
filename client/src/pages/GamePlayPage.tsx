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
  const { resign, requestDraw, respondDraw, initGame } = useGameRoom(roomId || '');
  const [chatMessages, setChatMessages] = useState<Array<{ userId: string; nickname: string; message: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [opponentDrawRequest, setOpponentDrawRequest] = useState(false);
  const [wangbaResult, setWangbaResult] = useState<{ loserId: string; winnerIds: string[] } | null>(null);
  const skipLeaveRef = useRef(false);
  const hasJoinedRef = useRef(false);

  const gameType = currentRoom?.gameType;
  const isBoardGame = gameType ? BOARD_GAMES.includes(gameType) : true;

  useEffect(() => {
    if (roomId) {
      (window as any).__currentRoomId = roomId;
      (window as any).__socket = getSocket();
      hasJoinedRef.current = true;
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !gameType) return;
    initGame(gameType, wangbaDrawMode);
  }, [roomId, gameType]);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) return;

    const handleChat = (data: any) => { setChatMessages((prev) => [...prev, data]); };
    const handleDrawReq = () => setOpponentDrawRequest(true);
    const handleDrawRes = () => { setOpponentDrawRequest(false); };
    const handlePlayerDisconnected = (data: { userId: string; nickname: string }) => {
      alert(`${data.nickname} 已断开连接，等待重连...`);
    };
    const handleGameOverWangba = (data: any) => {
      if (data.loserId) { setWangbaResult({ loserId: data.loserId, winnerIds: data.winnerIds || [] }); }
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
      if (hasJoinedRef.current && !skipLeaveRef.current) { /* 不在 cleanup 中发送 room:leave，避免 StrictMode 双重挂载导致误离开 */ }
    };
  }, [roomId]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    (window as any).__socket?.emit('game:chat', { roomId, message: chatInput });
    setChatInput('');
  };

  const handleResign = () => { if (confirm('确定要认输吗？')) { resign(); } };

  const handleDrawRequest = () => { requestDraw(); };

  const handleDrawResponse = (accept: boolean) => { respondDraw(accept); setOpponentDrawRequest(false); };

  const getPlayerColorName = (color: string) => {
    const m: Record<string,string> = { BLACK:'黑方', WHITE:'白方', RED:'红方', BLUE:'蓝方' };
    return m[color] || color;
  };

  const gameFinished = !!(gameOver || wangbaResult);

  const panelStyle: React.CSSProperties = { marginBottom: '16px' };

  return (
    <div className="flex-layout-sidebar" style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>
      {/* 棋盘区域 */}
      <div className="main-area" style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        {gameType === GameType.GOMOKU && <GomokuBoard />}
        {gameType === GameType.XIANGQI && <XiangqiBoard />}
        {gameType === GameType.CHESS && <ChessBoard />}
        {gameType === GameType.WANGBA && <WangbaBoard />}
        {!gameType && (
          <div className="nes-container is-centered" style={{ padding: '64px' }}>
            <i className="nes-pokeball" style={{ display: 'block', margin: '0 auto 16px' }} />
            <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '15px', color: '#888' }}>
              等待游戏开始...
            </p>
          </div>
        )}
      </div>

      {/* 侧边栏 */}
      <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ===== 游戏信息面板 ===== */}
        <div className="nes-container with-title" style={panelStyle}>
          <p className="title" style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '14px' }}>
            {gameType === GameType.GOMOKU ? '⚫ 五子棋' :
             gameType === GameType.XIANGQI ? '🏯 中国象棋' :
             gameType === GameType.CHESS ? '♟️ 国际象棋' :
             gameType === GameType.WANGBA ? '🐢 抽王八' : '🎮 游戏'}
          </p>

          {gameFinished ? (
            <div style={{ textAlign: 'center', padding: '8px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>
                {wangbaResult ? '🐢' : (gameOver?.winner ? '🏆' : '🤝')}
              </div>
              <p style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '14px', marginBottom: '8px' }}>
                游戏结束!
              </p>
              {wangbaResult ? (
                <div>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: 'var(--error-color)' }}>
                    🐢 王八: {currentRoom?.players.find(p => p.userId === wangbaResult.loserId)?.nickname || '?'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                    {wangbaResult.winnerIds.map((id, i) => (
                      <span key={id} className="nes-badge">
                        <span className="is-success">
                          {['🥇','🥈','🥉'][i]} {currentRoom?.players.find(p => p.userId === id)?.nickname || '?'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px' }}>
                    {gameOver?.winner ? `${getPlayerColorName(gameOver.winner)} 获胜` : '平局'}
                  </p>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '13px', color: '#888' }}>
                    {gameOver?.reason}
                  </p>
                </div>
              )}
              <button onClick={() => { skipLeaveRef.current = true; navigate(`/room/${roomId}`); }}
                className="nes-btn is-primary" style={{ width: '100%', marginTop: '12px', fontSize: '13px' }}>
                返回房间
              </button>
            </div>
          ) : (
            <div>
              {isBoardGame && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>当前回合</span>
                    <span style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '13px' }}>
                      {currentPlayer ? getPlayerColorName(currentPlayer) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888' }}>步数</span>
                    <span style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '14px' }}>
                      {boardState?.moveCount || 0}
                    </span>
                  </div>
                  {boardState?.inCheck && (
                    <div style={{ padding: '10px', border: '2px solid var(--error-color)', textAlign: 'center' }}>
                      <span style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: 'var(--error-color)' }}>
                        ⚠️ {getPlayerColorName(boardState.inCheck)}被将军!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== 操作按钮 (仅棋盘游戏) ===== */}
        {!gameFinished && isBoardGame && (
          <div className="nes-container" style={panelStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={handleResign} className="nes-btn is-error" style={{ width: '100%', fontSize: '13px' }}>
                🏳️ 认输
              </button>
              <button onClick={handleDrawRequest} className="nes-btn" style={{ width: '100%', fontSize: '13px' }}>
                🤝 求和
              </button>
              {opponentDrawRequest && (
                <div className="nes-container" style={{ borderColor: 'var(--primary-color)', padding: '12px' }}>
                  <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', textAlign: 'center', marginBottom: '8px' }}>
                    对方请求和棋
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleDrawResponse(true)}
                      className="nes-btn is-success" style={{ flex: 1, fontSize: '12px' }}>同意</button>
                    <button onClick={() => handleDrawResponse(false)}
                      className="nes-btn is-error" style={{ flex: 1, fontSize: '12px' }}>拒绝</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 聊天面板 ===== */}
        <div className="nes-container with-title" style={{ ...panelStyle, flex: 1 }}>
          <p className="title" style={{ fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize: '14px' }}>💬 聊天</p>
          <div style={{ height: '160px', overflowY: 'auto', padding: '8px', background: '#f8f8f0', border: '2px solid #000', marginBottom: '8px' }}>
            {chatMessages.length === 0 && (
              <p style={{ fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px', color: '#888', textAlign: 'center', paddingTop: '48px' }}>
                暂无消息
              </p>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} style={{ fontSize: '14px', marginBottom: '4px', fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>
                <strong>{msg.nickname}</strong>: {msg.message}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="输入消息..."
              className="nes-input"
              style={{ flex: 1, fontFamily: "'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize: '14px' }} />
            <button onClick={handleSendChat} className="nes-btn is-primary" style={{ fontSize: '13px', padding: '4px 12px' }}>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
