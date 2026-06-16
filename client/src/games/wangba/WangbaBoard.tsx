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

const PLAYER_ACCENT: Record<number, { bg: string; border: string; dot: string; glow: string }> = {
  0: { bg: 'from-rose-50 to-rose-100/50', border: 'border-rose-300', dot: 'bg-rose-500', glow: 'rgba(251,113,133,0.4)' },
  1: { bg: 'from-sky-50 to-sky-100/50', border: 'border-sky-300', dot: 'bg-sky-500', glow: 'rgba(14,165,233,0.4)' },
  2: { bg: 'from-emerald-50 to-emerald-100/50', border: 'border-emerald-300', dot: 'bg-emerald-500', glow: 'rgba(16,185,129,0.4)' },
  3: { bg: 'from-amber-50 to-amber-100/50', border: 'border-amber-300', dot: 'bg-amber-500', glow: 'rgba(251,191,36,0.4)' },
};

const RANK_LABEL: Record<string, string> = {
  'A': 'A', 'K': 'K', 'Q': 'Q', 'J': 'J', '10': '10', '9': '9',
  '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2',
};

// ==================== 卡牌渲染 ====================

function getCardInfo(card: WangbaCard) {
  if (card.suit === 'joker') {
    return {
      symbol: '🃏',
      label: card.rank === 'big_joker' ? '大王' : '小王',
      colorClass: card.rank === 'big_joker' ? 'text-red-500' : 'text-slate-700',
      bgGradient: card.rank === 'big_joker'
        ? 'from-yellow-50 to-red-50'
        : 'from-slate-50 to-slate-100',
    };
  }
  const suit = SUIT_SYMBOLS[card.suit] || '';
  const rank = RANK_LABEL[card.rank] || card.rank;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return {
    symbol: suit,
    label: rank,
    colorClass: isRed ? 'text-rose-500' : 'text-slate-800',
    bgGradient: 'from-white to-gray-50',
  };
}

/** 单张卡牌正面 */
function CardFace({ card, size = 'normal' }: { card: WangbaCard; size?: 'sm' | 'normal' | 'lg' }) {
  const info = getCardInfo(card);
  const sizeClasses = {
    sm: 'w-9 h-12 text-[10px] rounded-md border',
    normal: 'w-12 h-16 text-xs rounded-lg border-2',
    lg: 'w-16 h-22 text-sm rounded-xl border-2',
  };
  const containerCls = sizeClasses[size];
  const suitSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-lg';
  const rankSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div
      className={`${containerCls} bg-gradient-to-b ${info.bgGradient} border-gray-200 shadow-md
        flex flex-col items-center justify-center font-bold ${info.colorClass}
        select-none transition-transform duration-200 hover:scale-105 hover:shadow-lg cursor-default`}
    >
      {card.suit === 'joker' ? (
        <div className="text-center leading-tight">
          <div className={suitSize}>{info.symbol}</div>
          <div className={`${rankSize} mt-0.5 font-medium`}>{info.label}</div>
        </div>
      ) : (
        <div className="text-center leading-tight">
          <div className={suitSize}>{info.symbol}</div>
          <div className={`${rankSize} mt-0.5 font-semibold`}>{info.label}</div>
        </div>
      )}
    </div>
  );
}

/** 卡牌背面 */
function CardBack({ size = 'normal' }: { size?: 'sm' | 'normal' }) {
  const sizeClasses = {
    sm: 'w-9 h-12 rounded-md',
    normal: 'w-12 h-16 rounded-lg',
  };
  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700
        border-2 border-blue-400/50 shadow-md flex items-center justify-center
        select-none transition-transform duration-200 hover:scale-105`}
    >
      <div className="w-[70%] h-[75%] rounded-md bg-blue-600/60 border border-blue-400/40
        flex items-center justify-center"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      >
        <span className="text-blue-300/70 text-xs">🂠</span>
      </div>
    </div>
  );
}

/** 扇形排列的牌背 */
function FannedCardBacks({ count, max = 5 }: { count: number; max?: number }) {
  if (count === 0) {
    return <span className="text-xs text-gray-400 italic">无手牌</span>;
  }
  const show = Math.min(count, max);
  return (
    <div className="flex items-center pl-2">
      {Array.from({ length: show }).map((_, i) => (
        <div
          key={i}
          style={{ marginLeft: i > 0 ? '-18px' : '0', zIndex: show - i }}
          className="transition-transform duration-200 hover:scale-105"
        >
          <CardBack size="sm" />
        </div>
      ))}
      {count > max && (
        <span className="text-[11px] text-gray-400 font-medium ml-1.5">+{count - max}</span>
      )}
    </div>
  );
}

/** 扇形排列的已消对子 */
function DiscardPairRow({ pair }: { pair: [WangbaCard, WangbaCard] }) {
  return (
    <div className="flex items-center gap-0.5 bg-white/60 rounded-lg px-2 py-1 shadow-sm
      transition-transform duration-200 hover:scale-105">
      <CardFace card={pair[0]} size="sm" />
      <span className="text-gray-300 text-[10px] mx-0.5">×</span>
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

  // 监听游戏同步
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onSync = (data: WangbaSyncData) => {
      setMyHand(data.myHand);
      setMyDiscards(data.myDiscards);
      setPlayers(data.players);
      setCurrentPlayerIndex(data.currentPlayerIndex);
      setPhase(data.phase);
      setEliminatedPlayers(data.eliminatedPlayers);
      setLoserId(data.loserId);
      setDrawMode(data.drawMode);
    };

    const onDrawResult = (data: WangbaDrawResult) => {
      setLastResult(data);
      setResultVisible(true);
      setDrawing(false);
      // 3 秒后自动隐藏结果
      setTimeout(() => setResultVisible(false), 4000);
    };

    socket.on('game:wangba_sync', onSync);
    socket.on('game:wangba_draw_result', onDrawResult);

    return () => {
      socket.off('game:wangba_sync', onSync);
      socket.off('game:wangba_draw_result', onDrawResult);
    };
  }, []);

  // 抽牌
  const handleDraw = useCallback((targetPlayerId: string) => {
    if (drawing) return;
    setDrawing(true);
    const socket = getSocket();
    const roomId = (window as any).__currentRoomId;
    socket?.emit('game:wangba_draw', { roomId, targetPlayerId });
  }, [drawing]);

  if (!myUserId) return null;

  // 计算可被抽牌的其他玩家
  const drawablePlayers = players.filter(p => {
    if (p.userId === myUserId || p.eliminated || p.handCount === 0) return false;
    if (drawMode === 'neighbor') {
      const n = players.length;
      let nextIdx = (currentPlayerIndex + 1) % n;
      for (let i = 0; i < n; i++) {
        const next = players[nextIdx];
        if (!next.eliminated && next.handCount > 0) {
          return next.userId === p.userId;
        }
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

  // 计算其他玩家列表 (排除自己)
  const otherPlayers = players.filter(p => p.userId !== myUserId);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 px-2 animate-fade-in">

      {/* ========== 顶部状态栏 ========== */}
      <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* 装饰色条 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* 左侧：游戏标题 + 状态 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🐢</span>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">抽王八</h3>
                  <p className="text-xs text-gray-400">
                    {drawMode === 'neighbor' ? '🔄 顺时针模式' : '🎲 任意抽模式'}
                  </p>
                </div>
              </div>

              {/* 阶段标签 */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                gameFinished
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
                {gameFinished ? '游戏结束' : phase === 'DEALING' ? '发牌中...' : '游戏中'}
              </div>
            </div>

            {/* 右侧：当前回合 */}
            {phase === 'DRAWING' && !gameFinished && (
              <div className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                isMyTurn
                  ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 shadow-md shadow-amber-200/50'
                  : 'bg-gray-50 text-gray-500'
              }`}>
                {isMyTurn ? (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                    轮到你了！请抽牌
                  </span>
                ) : (
                  <span>⏳ 等待 {currentPlayer?.nickname || '...'} 抽牌</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== 抽牌结果通知 ========== */}
      {lastResult && resultVisible && (
        <div className="animate-slide-down overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-5 py-3.5
            border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {lastResult.newPair ? '🎯' : '👋'}
              </span>
              <div className="flex-1 min-w-0">
                {(() => {
                  const drawer = players.find(p => p.userId === lastResult.drawingPlayerId);
                  const target = players.find(p => p.userId === lastResult.targetPlayerId);
                  const info = getCardInfo(lastResult.drawnCard);
                  return (
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">{drawer?.nickname || '?'}</span>
                      {' 从 '}
                      <span className="font-semibold">{target?.nickname || '?'}</span>
                      {' 手中抽到了 '}
                      <span className={`font-bold ${info.colorClass}`}>
                        {info.symbol}{info.label}
                      </span>
                      {lastResult.newPair && (
                        <span className="ml-1 text-emerald-600 font-medium">，配成对子消掉！✨</span>
                      )}
                    </p>
                  );
                })()}
                {lastResult.eliminatedPlayerId && (
                  (() => {
                    const elim = players.find(p => p.userId === lastResult.eliminatedPlayerId);
                    return (
                      <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                        🎉 {elim?.nickname || '?'} 手牌清空，胜出！
                      </p>
                    );
                  })()
                )}
              </div>
              <button
                onClick={() => setResultVisible(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 其他玩家区域 ========== */}
      <div className={`grid gap-4 ${
        otherPlayers.length <= 2
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {otherPlayers.map((p) => {
          const playerGlobalIdx = players.findIndex(pl => pl.userId === p.userId);
          const accent = PLAYER_ACCENT[playerGlobalIdx] || PLAYER_ACCENT[0];
          const isCurrent = p.userId === currentPlayer?.userId;
          const isEliminated = p.eliminated;
          const canDraw = isMyTurn && !isEliminated && p.handCount > 0;
          const isDrawable = drawablePlayers.some(dp => dp.userId === p.userId);

          return (
            <div
              key={p.userId}
              className={`relative bg-white rounded-2xl shadow-sm border transition-all duration-300
                overflow-hidden
                ${isCurrent && !isEliminated ? 'animate-glow-pulse border-amber-300' : 'border-gray-100'}
                ${isEliminated ? 'opacity-50' : ''}
                ${isDrawable && isMyTurn ? 'ring-2 ring-orange-400/30' : ''}`}
            >
              {/* 顶部彩色装饰条 */}
              <div className={`h-1.5 bg-gradient-to-r ${accent.bg.replace('from-', 'from-').replace('to-', 'to-')}`}
                style={{
                  background: `linear-gradient(90deg, var(--tw-gradient-from, #f59e0b), var(--tw-gradient-to, #ef4444))`,
                }}
              />

              <div className="p-4">
                {/* 玩家名 + 状态 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${accent.dot} shrink-0`} />
                    <span className="font-semibold text-gray-800 truncate text-sm">{p.nickname}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isEliminated && (
                      <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        已胜出 🎉
                      </span>
                    )}
                    {isCurrent && !isEliminated && (
                      <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        当前回合
                      </span>
                    )}
                  </div>
                </div>

                {/* 手牌 (扇形牌背) */}
                <div className="mb-3">
                  <p className="text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                    手牌 · {p.handCount} 张
                  </p>
                  <FannedCardBacks count={p.handCount} />
                </div>

                {/* 已消对子 */}
                <p className="text-[11px] text-gray-400 font-medium">
                  已消对子 · {p.discardCount} 对
                </p>

                {/* 抽牌按钮 */}
                {canDraw && (
                  <button
                    onClick={() => handleDraw(p.userId)}
                    disabled={drawing}
                    className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold
                      transition-all duration-200 flex items-center justify-center gap-1.5
                      ${drawing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-300 hover:from-orange-500 hover:to-amber-600 active:scale-[0.98]'
                      }`}
                  >
                    {drawing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        抽牌中...
                      </>
                    ) : (
                      <>
                        <span>🫳</span> 从这里抽牌
                      </>
                    )}
                  </button>
                )}

                {/* 不可抽牌提示 */}
                {!canDraw && isMyTurn && !isEliminated && p.handCount === 0 && (
                  <p className="mt-4 text-[11px] text-gray-400 text-center">该玩家无手牌</p>
                )}
                {!canDraw && isMyTurn && !isEliminated && p.handCount > 0 && !isDrawable && drawMode === 'neighbor' && (
                  <p className="mt-4 text-[11px] text-gray-400 text-center">仅能从下家抽牌</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========== 我的手牌区域 ========== */}
      <div className={`relative bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
        isMyTurn && hasCards && !gameFinished
          ? 'border-amber-300 shadow-md shadow-amber-100/50'
          : 'border-gray-100'
      }`}>
        {/* 顶部装饰条 */}
        <div className={`h-1.5 bg-gradient-to-r transition-all duration-300 ${
          isMyTurn && hasCards && !gameFinished
            ? 'from-amber-400 to-orange-400'
            : 'from-gray-200 to-gray-300'
        }`} />

        <div className="p-5">
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                myPlayerIndex >= 0 ? PLAYER_ACCENT[myPlayerIndex]?.dot || 'bg-gray-400' : 'bg-gray-400'
              }`} />
              <h4 className="font-bold text-gray-800">
                我的手牌
                <span className="text-gray-400 font-normal ml-1.5">({myHand.length} 张)</span>
              </h4>
            </div>
            {isMyTurn && hasCards && !gameFinished && (
              <span className="text-sm text-orange-500 font-medium animate-pulse flex items-center gap-1">
                <span>👆</span> 从上方选择一位玩家抽牌
              </span>
            )}
            {imEliminated && !gameFinished && (
              <span className="text-sm text-emerald-600 font-medium">✅ 已胜出</span>
            )}
          </div>

          {/* 手牌展示 */}
          {myHand.length === 0 ? (
            <div className="py-10 text-center animate-fade-in">
              <div className="text-5xl mb-3">{gameFinished ? '🐢' : '🎉'}</div>
              <p className="text-gray-600 font-semibold">
                {gameFinished
                  ? (loserId === myUserId ? '你是"王八"！' : '游戏结束！')
                  : '你没有手牌了！'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {gameFinished
                  ? ''
                  : imEliminated ? '你已胜出，等待其他玩家完成游戏...' : '等待下一轮...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 justify-center animate-fade-in-up">
              {myHand.map((card, idx) => (
                <div
                  key={card.id || idx}
                  className="transition-all duration-200 hover:-translate-y-1"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <CardFace card={card} size="normal" />
                </div>
              ))}
            </div>
          )}

          {/* 已消对子 */}
          {myDiscards.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-medium mb-2.5 uppercase tracking-wide">
                已消对子 · {myDiscards.length} 对
              </p>
              <div className="flex flex-wrap gap-2">
                {myDiscards.map((pair, idx) => (
                  <DiscardPairRow key={idx} pair={pair} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== 游戏结束面板 ========== */}
      {gameFinished && (
        <div className="animate-pop-in">
          <div className={`rounded-2xl p-7 text-center border-2 shadow-lg ${
            loserId === myUserId
              ? 'bg-gradient-to-b from-red-50 to-orange-50 border-red-200'
              : 'bg-gradient-to-b from-emerald-50 to-teal-50 border-emerald-200'
          }`}>
            <div className="text-6xl mb-4 animate-celebrate">
              {loserId === myUserId ? '🐢' : '🎉'}
            </div>
            <h3 className="text-2xl font-extrabold mb-2 text-gray-800">游戏结束！</h3>

            {loserId === myUserId ? (
              <div>
                <p className="text-xl font-bold text-red-500 mb-2">😭 你是"王八"！你输了！</p>
                <p className="text-sm text-gray-500">你最终持有小王 🃏，成为了输家</p>
              </div>
            ) : (
              <div>
                <p className="text-xl font-bold text-emerald-600 mb-2">🎊 恭喜！你赢了！</p>
                <p className="text-sm text-gray-500">
                  输家（王八）: <span className="font-semibold text-red-500">
                    {players.find(p => p.userId === loserId)?.nickname || '?'}
                  </span>
                </p>
              </div>
            )}

            {/* 排名展示 */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {eliminatedPlayers
                .filter(id => id !== loserId)
                .map((id, i) => (
                  <span key={id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70
                    rounded-full text-sm font-medium text-gray-700 shadow-sm border border-gray-200">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐'}
                    {players.find(p => p.userId === id)?.nickname || '?'}
                  </span>
                ))}
            </div>

            {/* 回到房间按钮 - 由 GamePlayPage 侧边栏提供即可 */}
            <p className="text-xs text-gray-400 mt-5">
              可通过右侧面板返回房间
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
