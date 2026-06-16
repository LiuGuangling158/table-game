import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../services/socket';
import {
  WangbaCard, WangbaSyncData, WangbaPlayerView, WangbaDrawResult,
} from 'shared';

// ==================== 卡牌渲染工具 ====================

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-800',
  spades: 'text-gray-800',
  joker: 'text-purple-500',
};

function getCardDisplay(card: WangbaCard): { text: string; colorClass: string } {
  if (card.suit === 'joker') {
    return {
      text: card.rank === 'big_joker' ? '🃏\n大王' : '🃏\n小王',
      colorClass: card.rank === 'big_joker' ? 'text-red-500' : 'text-gray-800',
    };
  }
  const rankDisplay: Record<string, string> = {
    'A': 'A', 'K': 'K', 'Q': 'Q', 'J': 'J',
    '10': '10', '9': '9', '8': '8', '7': '7',
    '6': '6', '5': '5', '4': '4', '3': '3', '2': '2',
  };
  return {
    text: `${SUIT_SYMBOLS[card.suit] || ''}${rankDisplay[card.rank] || card.rank}`,
    colorClass: SUIT_COLORS[card.suit] || 'text-gray-800',
  };
}

function CardFace({ card, small }: { card: WangbaCard; small?: boolean }) {
  const { text, colorClass } = getCardDisplay(card);
  const sizeClass = small ? 'w-10 h-14 text-xs' : 'w-14 h-20 text-sm';

  return (
    <div
      className={`${sizeClass} bg-white rounded-lg border-2 border-gray-300 shadow flex flex-col items-center justify-center font-bold ${colorClass} select-none`}
    >
      {card.suit === 'joker' ? (
        <div className="text-center leading-tight">
          <div className={card.rank === 'big_joker' ? 'text-lg' : 'text-lg'}>🃏</div>
          <div className="text-[10px]">{card.rank === 'big_joker' ? '大王' : '小王'}</div>
        </div>
      ) : (
        <div className="text-center leading-tight">
          <div className={small ? 'text-lg' : 'text-xl'}>{SUIT_SYMBOLS[card.suit]}</div>
          <div className={small ? 'text-xs' : 'text-sm'}>{card.rank}</div>
        </div>
      )}
    </div>
  );
}

function CardBack({ small }: { small?: boolean }) {
  const sizeClass = small ? 'w-10 h-14' : 'w-14 h-20';
  return (
    <div
      className={`${sizeClass} bg-blue-700 rounded-lg border-2 border-blue-900 shadow flex items-center justify-center`}
    >
      <div className="w-3/4 h-3/4 rounded border border-blue-400 bg-blue-600 flex items-center justify-center">
        <span className="text-blue-300 text-xs">🂠</span>
      </div>
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
      setDrawing(false);
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

  // 获取可被抽牌的其他玩家（非自己、未淘汰、有手牌）
  const drawablePlayers = players.filter(p => {
    if (p.userId === myUserId || p.eliminated || p.handCount === 0) return false;

    // neighbor 模式: 只有顺时针下家可抽
    if (drawMode === 'neighbor') {
      const n = players.length;
      // 从当前位置顺时针找第一个未淘汰且有手牌的玩家
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

    // any 模式: 所有对手都可被抽
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 游戏状态栏 */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">♠️ 抽王八</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {phase === 'DRAWING' ? '游戏中' : phase === 'FINISHED' ? '游戏结束' : '发牌中...'}
            </p>
          </div>
          {phase === 'DRAWING' && (
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              isMyTurn ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-100 text-gray-500'
            }`}>
              {isMyTurn ? '轮到你了！请抽牌' : `等待 ${currentPlayer?.nickname || '...'} 抽牌`}
            </div>
          )}
        </div>
      </div>

      {/* 上次抽牌结果 */}
      {lastResult && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 animate-slide-in">
          {(() => {
            const drawer = players.find(p => p.userId === lastResult.drawingPlayerId);
            const target = players.find(p => p.userId === lastResult.targetPlayerId);
            const { text } = getCardDisplay(lastResult.drawnCard);
            let msg = `${drawer?.nickname || '?'} 从 ${target?.nickname || '?'} 手中抽到了 ${text}`;
            if (lastResult.newPair) {
              msg += '，并配成一对消掉了！';
            }
            if (lastResult.eliminatedPlayerId) {
              const elim = players.find(p => p.userId === lastResult.eliminatedPlayerId);
              msg += ` 🎉 ${elim?.nickname || '?'} 手牌清空，胜出！`;
            }
            return <span>{msg}</span>;
          })()}
        </div>
      )}

      {/* 其他玩家区域 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {players.filter(p => p.userId !== myUserId).map((p) => {
          const isCurrent = p.userId === currentPlayer?.userId;
          const isEliminated = p.eliminated;
          const canDraw = isMyTurn && !isEliminated && p.handCount > 0;

          return (
            <div
              key={p.userId}
              className={`relative bg-white rounded-xl shadow-sm border p-4 transition-all ${
                isCurrent && !isEliminated ? 'ring-2 ring-yellow-400' : ''
              } ${isEliminated ? 'opacity-50' : ''}`}
            >
              {/* 玩家名 */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-gray-800 truncate">{p.nickname}</span>
                {isEliminated && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已胜出 🎉</span>
                )}
                {isCurrent && !isEliminated && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">当前回合</span>
                )}
              </div>

              {/* 手牌 (牌背) */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1.5">手牌 ({p.handCount}张)</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(p.handCount, 8) }).map((_, i) => (
                    <CardBack key={i} small />
                  ))}
                  {p.handCount > 8 && (
                    <span className="text-xs text-gray-400 self-end ml-1">+{p.handCount - 8}</span>
                  )}
                  {p.handCount === 0 && (
                    <span className="text-xs text-gray-400">无</span>
                  )}
                </div>
              </div>

              {/* 已消对子 */}
              <p className="text-xs text-gray-500">
                已消对子: {p.discardCount} 对
              </p>

              {/* 抽牌按钮 */}
              {canDraw && (
                <button
                  onClick={() => handleDraw(p.userId)}
                  disabled={drawing}
                  className="mt-3 w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {drawing ? '抽牌中...' : '🫳 从这里抽牌'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 我的手牌区域 */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-800">我的手牌 ({myHand.length}张)</h4>
          {isMyTurn && (
            <span className="text-sm text-orange-600 font-medium animate-pulse">
              👆 请从上方选择一位玩家抽牌
            </span>
          )}
        </div>

        {/* 手牌展示 */}
        {myHand.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-gray-500 font-medium">你没有手牌了！</p>
            <p className="text-sm text-gray-400 mt-1">
              {eliminatedPlayers.includes(myUserId)
                ? '你已胜出，等待其他玩家完成游戏...'
                : '等待下一轮...'}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((card, idx) => (
              <CardFace key={card.id || idx} card={card} />
            ))}
          </div>
        )}

        {/* 已消对子 */}
        {myDiscards.length > 0 && (
          <div className="mt-5 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">已消对子 ({myDiscards.length}对)</p>
            <div className="flex flex-wrap gap-2">
              {myDiscards.map((pair, idx) => (
                <div key={idx} className="flex gap-1 items-center bg-gray-50 rounded-lg px-2 py-1">
                  <CardFace card={pair[0]} small />
                  <span className="text-gray-400 text-xs">+</span>
                  <CardFace card={pair[1]} small />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 游戏结束信息 */}
      {phase === 'FINISHED' && (
        <div className="bg-yellow-50 rounded-xl p-6 text-center border border-yellow-200">
          <div className="text-4xl mb-3">🐢</div>
          <h3 className="text-xl font-bold text-yellow-700 mb-2">游戏结束！</h3>
          {loserId === myUserId ? (
            <div className="text-red-600 font-bold text-lg">😭 你是"王八"！你输了！</div>
          ) : (
            <div className="text-green-600 font-bold text-lg">🎉 恭喜！你赢了！</div>
          )}
          <p className="text-sm text-gray-500 mt-2">
            输家: {players.find(p => p.userId === loserId)?.nickname || '?'} (持有小王 🃏)
          </p>
          <p className="text-sm text-gray-500">
            赢家: {eliminatedPlayers.filter(id => id !== loserId).map(id => players.find(p => p.userId === id)?.nickname || '?').join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
