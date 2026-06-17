import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../services/socket';
import {
  WangbaCard, WangbaSyncData, WangbaPlayerView, WangbaDrawResult,
} from 'shared';

// ==================== 常量 ====================

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

const PLAYER_COLORS: Record<number, { accent: string; light: string }> = {
  0: { accent: '#e76e55', light: '#fce4e4' },
  1: { accent: '#209cee', light: '#e4f0fc' },
  2: { accent: '#92cc41', light: '#e4fce4' },
  3: { accent: '#f7d51d', light: '#fcf8e4' },
};

const RANK_LABEL: Record<string, string> = {
  'A':'A','K':'K','Q':'Q','J':'J','10':'10','9':'9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2',
};

// ==================== 卡牌渲染 ====================

function getCardInfo(card: WangbaCard) {
  if (card.suit === 'joker') {
    return {
      symbol: '🃏',
      label: card.rank === 'big_joker' ? '大王' : '小王',
      color: card.rank === 'big_joker' ? 'var(--error-color)' : '#555',
      isRed: card.rank === 'big_joker',
    };
  }
  const suit = SUIT_SYMBOLS[card.suit] || '';
  const rank = RANK_LABEL[card.rank] || card.rank;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return { symbol: suit, label: rank, color: isRed ? 'var(--error-color)' : 'var(--text-color)', isRed };
}

function CardFace({ card, size = 'normal' }: { card: WangbaCard; size?: 'sm' | 'normal' | 'lg' }) {
  const info = getCardInfo(card);
  const sizeMap = {
    sm: { w:36, h:50, fs:12, suit:14 },
    normal: { w:50, h:68, fs:12, suit:20 },
    lg: { w:64, h:88, fs:14, suit:26 },
  };
  const s = sizeMap[size];

  return (
    <div style={{
      width: s.w, height: s.h, background: '#fff', border: '3px solid #000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", color: info.color,
      cursor: 'default', userSelect: 'none', imageRendering: 'pixelated',
      transition: 'transform 0.1s steps(1)',
    }}
    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
      {card.suit === 'joker' ? (
        <>
          <div style={{ fontSize: s.suit }}>{info.symbol}</div>
          <div style={{ fontSize: s.fs, marginTop: 2 }}>{info.label}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: s.suit }}>{info.symbol}</div>
          <div style={{ fontSize: s.fs, marginTop: 2, fontWeight: 'bold' }}>{info.label}</div>
        </>
      )}
    </div>
  );
}

function CardBack({ size = 'normal' }: { size?: 'sm' | 'normal' }) {
  const s = size === 'sm' ? { w:36, h:50 } : { w:50, h:68 };
  return (
    <div style={{
      width: s.w, height: s.h, background: '#209cee', border: '3px solid #000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', imageRendering: 'pixelated',
      backgroundImage: `
        linear-gradient(45deg, #1060a0 25%, transparent 25%),
        linear-gradient(-45deg, #1060a0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1060a0 75%),
        linear-gradient(-45deg, transparent 75%, #1060a0 75%)`,
      backgroundSize: '8px 8px',
      backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
      transition: 'transform 0.1s steps(1)',
    }}
    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
      <div style={{ width:'60%', height:'65%', border:'2px solid rgba(255,255,255,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>?</span>
      </div>
    </div>
  );
}

function FannedCardBacks({ count, max = 5 }: { count: number; max?: number }) {
  if (count === 0) return <span style={{ fontSize:14, color:'#888', fontStyle:'italic', fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>无手牌</span>;
  const show = Math.min(count, max);
  return (
    <div style={{ display:'flex', alignItems:'center', paddingLeft:8 }}>
      {Array.from({ length: show }).map((_, i) => (
        <div key={i} style={{ marginLeft: i>0 ? -14 : 0, zIndex: show-i }}>
          <CardBack size="sm" />
        </div>
      ))}
      {count > max && <span style={{ fontSize:12, color:'#888', marginLeft:6 }}>+{count - max}</span>}
    </div>
  );
}

function DiscardPairRow({ pair }: { pair: [WangbaCard, WangbaCard] }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2, background:'rgba(255,255,255,0.8)', padding:'4px 8px', border:'2px solid #ccc' }}>
      <CardFace card={pair[0]} size="sm" />
      <span style={{ color:'#aaa', fontSize:12, margin:'0 2px' }}>×</span>
      <CardFace card={pair[1]} size="sm" />
    </div>
  );
}

// ==================== 主组件 ====================

export default function WangbaBoard() {
  const user = useAuthStore((s) => s.user);
  const [myHand, setMyHand] = useState<WangbaCard[]>([]);
  const [myDiscards, setMyDiscards] = useState<[WangbaCard, WangbaCard][]>([]);
  const [players, setPlayers] = useState<WangbaPlayerView[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [phase, setPhase] = useState<string>('DEALING');
  const [eliminatedPlayers, setEliminatedPlayers] = useState<string[]>([]);
  const [loserId, setLoserId] = useState<string | undefined>();
  const [lastResult, setLastResult] = useState<WangbaDrawResult | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<string>('neighbor');
  const [resultVisible, setResultVisible] = useState(false);

  const myUserId = user?.id;
  const isMyTurn = players[currentPlayerIndex]?.userId === myUserId && phase === 'DRAWING';
  const currentPlayer = players[currentPlayerIndex];

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onSync = (data: WangbaSyncData) => {
      setMyHand(data.myHand); setMyDiscards(data.myDiscards);
      setPlayers(data.players); setCurrentPlayerIndex(data.currentPlayerIndex);
      setPhase(data.phase); setEliminatedPlayers(data.eliminatedPlayers);
      setLoserId(data.loserId); setDrawMode(data.drawMode);
    };
    const onDrawResult = (data: WangbaDrawResult) => {
      setLastResult(data); setResultVisible(true); setDrawing(false);
      setTimeout(() => setResultVisible(false), 4000);
    };
    socket.on('game:wangba_sync', onSync);
    socket.on('game:wangba_draw_result', onDrawResult);
    return () => { socket.off('game:wangba_sync', onSync); socket.off('game:wangba_draw_result', onDrawResult); };
  }, []);

  const handleDraw = useCallback((targetPlayerId: string) => {
    if (drawing) return; setDrawing(true);
    const roomId = (window as any).__currentRoomId;
    getSocket()?.emit('game:wangba_draw', { roomId, targetPlayerId });
  }, [drawing]);

  if (!myUserId) return null;

  const drawablePlayers = players.filter(p => {
    if (p.userId === myUserId || p.eliminated || p.handCount === 0) return false;
    if (drawMode === 'neighbor') {
      const n = players.length;
      let nextIdx = (currentPlayerIndex + 1) % n;
      for (let i = 0; i < n; i++) {
        const next = players[nextIdx];
        if (!next.eliminated && next.handCount > 0) return next.userId === p.userId;
        nextIdx = (nextIdx + 1) % n;
      }
      return false;
    }
    return true;
  });

  const myPlayerIndex = players.findIndex(p => p.userId === myUserId);
  const hasCards = myHand.length > 0;
  const imEliminated = eliminatedPlayers.includes(myUserId);
  const gameFinished = phase === 'FINISHED';
  const otherPlayers = players.filter(p => p.userId !== myUserId);

  return (
    <div className="page-container" style={{ animation: 'pixel-fade-in 0.4s steps(4) both' }}>

      {/* ===== 顶部状态栏 ===== */}
      <div className="nes-container with-title" style={{ marginBottom: 16 }}>
        <p className="title" style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:14 }}>🐢 抽王八</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <span style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:15 }}>
              {drawMode === 'neighbor' ? '🔄 顺时针' : '🎲 任意抽'}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className={`nes-badge ${gameFinished ? '' : 'is-success'}`}>
              <span className={gameFinished ? '' : 'is-success'}>
                {gameFinished ? '游戏结束' : phase === 'DEALING' ? '发牌中...' : '游戏中'}
              </span>
            </span>
            {phase === 'DRAWING' && !gameFinished && (
              isMyTurn ? (
                <span style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14, color:'var(--warning-color)', fontWeight:'bold' }}>
                  👆 轮到你了！请抽牌
                </span>
              ) : (
                <span style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14, color:'#888' }}>
                  ⏳ 等待{currentPlayer?.nickname}抽牌...
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* ===== 抽牌结果通知 ===== */}
      {lastResult && resultVisible && (
        <div className="animate-pixel-slide-in" style={{ marginBottom: 16 }}>
          <section className="nes-balloon from-left" style={{ maxWidth:'100%', margin:0 }}>
            {(() => {
              const drawer = players.find(p => p.userId === lastResult.drawingPlayerId);
              const target = players.find(p => p.userId === lastResult.targetPlayerId);
              const info = getCardInfo(lastResult.drawnCard);
              return (
                <div>
                  <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14, lineHeight:1.6 }}>
                    <strong>{drawer?.nickname}</strong> 从 <strong>{target?.nickname}</strong> 手中抽到
                    <span style={{ color:info.color, fontWeight:'bold', margin:'0 2px' }}>
                      {info.symbol}{info.label}
                    </span>
                    {lastResult.newPair && <span style={{ color:'var(--success-color)' }}>，配对消除！✨</span>}
                  </p>
                  {lastResult.eliminatedPlayerId && (
                    <p style={{ fontSize:14, color:'var(--success-color)', marginTop:4, fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>
                      🎉 {players.find(p=>p.userId===lastResult.eliminatedPlayerId)?.nickname} 手牌清空，胜出！
                    </p>
                  )}
                </div>
              );
            })()}
            <button onClick={()=>setResultVisible(false)} className="nes-btn is-error" style={{ fontSize:12, padding:'2px 8px', marginTop:8 }}>关闭</button>
          </section>
        </div>
      )}

      {/* ===== 其他玩家区域 ===== */}
      <div className={otherPlayers.length <= 2 ? 'nes-grid-2' : 'nes-grid-3'} style={{ marginBottom: 16 }}>
        {otherPlayers.map((p) => {
          const playerGlobalIdx = players.findIndex(pl => pl.userId === p.userId);
          const pc = PLAYER_COLORS[playerGlobalIdx] || PLAYER_COLORS[0];
          const isCurrent = p.userId === currentPlayer?.userId;
          const isEliminated = p.eliminated;
          const canDraw = isMyTurn && !isEliminated && p.handCount > 0;
          const isDrawable = drawablePlayers.some(dp => dp.userId === p.userId);

          return (
            <div key={p.userId} className="nes-container with-title"
              style={{
                opacity: isEliminated ? 0.5 : 1,
                borderColor: (isCurrent && !isEliminated) ? 'var(--warning-color)' : (isDrawable && isMyTurn) ? pc.accent : '#000',
                borderWidth: (isDrawable && isMyTurn) ? '4px' : undefined,
                borderTop: `4px solid ${pc.accent}`,
              }}>
              <p className="title" style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace" }}>
                <span className={`pixel-dot ${isCurrent ? 'pixel-dot-online' : ''}`}
                  style={{ background: isCurrent ? 'var(--warning-color)' : pc.accent }} />
                {p.nickname}
                {isEliminated && <span className="nes-badge"><span className="is-success">胜出</span></span>}
                {isCurrent && !isEliminated && <span className="nes-badge"><span className="is-warning">回合</span></span>}
              </p>

              <div style={{ marginBottom: 12 }}>
                <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:13, color:'#888', marginBottom:6 }}>
                  手牌 · {p.handCount} 张
                </p>
                <FannedCardBacks count={p.handCount} />
              </div>

              <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:13, color:'#888' }}>
                已消对子 · {p.discardCount} 对
              </p>

              {canDraw && (
                <button onClick={() => handleDraw(p.userId)} disabled={drawing}
                  className={`nes-btn is-warning ${drawing ? 'is-disabled' : ''}`}
                  style={{ width:'100%', marginTop:12, fontSize:13 }}>
                  {drawing ? '抽牌中...' : '🫳 从这里抽牌'}
                </button>
              )}
              {!canDraw && isMyTurn && !isEliminated && p.handCount === 0 && (
                <p style={{ marginTop:12, fontSize:13, color:'#888', textAlign:'center', fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif" }}>该玩家无手牌</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== 我的手牌区域 ===== */}
      <div className="nes-container with-title"
        style={{
          marginBottom:16,
          borderColor: (isMyTurn && hasCards && !gameFinished) ? 'var(--warning-color)' : '#000',
          borderTop: `4px solid ${myPlayerIndex >= 0 ? (PLAYER_COLORS[myPlayerIndex] || PLAYER_COLORS[0]).accent : '#ccc'}`,
        }}>
        <p className="title" style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:14 }}>
          我的手牌 ({myHand.length}张)
        </p>

        {isMyTurn && hasCards && !gameFinished && (
          <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14, color:'var(--warning-color)', textAlign:'center', marginBottom:12 }}>
            👆 从上方选择一位玩家抽牌
          </p>
        )}

        {myHand.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:48, marginBottom:8 }}>{gameFinished ? '🐢' : '🎉'}</div>
            <p style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:14 }}>
              {gameFinished ? (loserId === myUserId ? "你是'王八'！" : '游戏结束！') : '没有手牌了！'}
            </p>
          </div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center' }}>
            {myHand.map((card, idx) => (
              <div key={card.id || idx} style={{ animationDelay: `${idx*30}ms` }}>
                <CardFace card={card} size="normal" />
              </div>
            ))}
          </div>
        )}

        {myDiscards.length > 0 && (
          <div style={{ marginTop:20, paddingTop:12, borderTop:'2px dashed #ccc' }}>
            <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:13, color:'#888', marginBottom:8 }}>
              已消对子 · {myDiscards.length} 对
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {myDiscards.map((pair, idx) => <DiscardPairRow key={idx} pair={pair} />)}
            </div>
          </div>
        )}
      </div>

      {/* ===== 游戏结束面板 ===== */}
      {gameFinished && (
        <div style={{
          textAlign:'center', padding:24, border:'4px solid',
          borderColor: loserId === myUserId ? 'var(--error-color)' : 'var(--success-color)',
          background: loserId === myUserId ? '#fce4e4' : '#e4fce4',
          marginBottom: 16,
          animation: 'pixel-pop-in 0.3s steps(3) both',
        }}>
          <div style={{ fontSize:64, marginBottom:8 }}>{loserId === myUserId ? '🐢' : '🎉'}</div>
          <h3 style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:18, marginBottom:12 }}>游戏结束！</h3>
          {loserId === myUserId ? (
            <div>
              <p style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:15, color:'var(--error-color)' }}>
                😭 你是"王八"！你输了！
              </p>
              <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14, color:'#888', marginTop:4 }}>
                你最终持有小王，成为了输家
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontFamily:"'PixelChinese', 'SimHei', 'PingFang SC', 'Microsoft YaHei', monospace", fontSize:15, color:'var(--success-color)' }}>
                🎊 恭喜！你赢了！
              </p>
              <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14, color:'#888', marginTop:4 }}>
                输家（王八）: <strong style={{ color:'var(--error-color)' }}>
                  {players.find(p => p.userId === loserId)?.nickname || '?'}
                </strong>
              </p>
            </div>
          )}
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:6, marginTop:16 }}>
            {eliminatedPlayers.filter(id => id !== loserId).map((id, i) => (
              <span key={id} className="nes-badge">
                <span className="is-success">
                  {['🥇','🥈','🥉'][i] || '⭐'} {players.find(p => p.userId === id)?.nickname || '?'}
                </span>
              </span>
            ))}
          </div>
          <p style={{ fontFamily:"'SimHei','PingFang SC','Microsoft YaHei',sans-serif", fontSize:13, color:'#aaa', marginTop:16 }}>
            可通过右侧面板返回房间
          </p>
        </div>
      )}
    </div>
  );
}
