import {
  WangbaCard, WangbaGameState, WangbaPlayerHand,
  WangbaDrawResult, WangbaGameOverResult, WangbaDrawMode,
  CardSuit, CardRank,
  PlayerColor, EndReason,
} from 'shared';

const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 抽王八游戏引擎
 *
 * 规则简述:
 * - 54 张牌 (52 普通 + 大王 + 小王)
 * - 同点数配对消掉，大小王无法配对
 * - 初始发牌后自动消除手中对子
 * - 玩家轮流从下家手中随机抽一张牌
 * - 抽到后若形成对子则消掉
 * - 手牌先清空的人胜出
 * - 最后手里只剩牌的人 (持有小王) 输
 */
export class WangbaEngine {
  /** 创建一副标准 54 张扑克牌 */
  createDeck(): WangbaCard[] {
    const deck: WangbaCard[] = [];
    let id = 0;

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, id: `card_${id++}` });
      }
    }

    // 大小王
    deck.push({ suit: 'joker', rank: 'big_joker', id: 'big_joker' });
    deck.push({ suit: 'joker', rank: 'small_joker', id: 'small_joker' });

    return deck;
  }

  /**
   * 从手牌中移除所有对子
   * @returns { handCards: 剩余手牌, discardPairs: 消掉的配对 }
   */
  removePairs(hand: WangbaCard[]): { handCards: WangbaCard[]; discardPairs: [WangbaCard, WangbaCard][] } {
    const discardPairs: [WangbaCard, WangbaCard][] = [];
    const remaining: WangbaCard[] = [];

    // 按 rank 分组
    const byRank = new Map<string, WangbaCard[]>();
    for (const card of hand) {
      const key = card.suit === 'joker' ? card.rank : card.rank;
      if (!byRank.has(key)) byRank.set(key, []);
      byRank.get(key)!.push(card);
    }

    for (const [key, cards] of byRank) {
      // joker 不配对
      if (key === 'big_joker' || key === 'small_joker') {
        remaining.push(...cards);
        continue;
      }
      // 两两配对
      let i = 0;
      while (i + 1 < cards.length) {
        discardPairs.push([cards[i], cards[i + 1]]);
        i += 2;
      }
      // 剩余单张
      if (i < cards.length) {
        remaining.push(cards[i]);
      }
    }

    return { handCards: remaining, discardPairs };
  }

  /**
   * 初始化游戏：洗牌、发牌、初始配对
   * @param playerUserIds userId 列表 (按顺序)
   * @param playerColors 对应的颜色列表
   */
  initGame(playerUserIds: string[], drawMode: WangbaDrawMode = 'neighbor'): WangbaGameState {
    if (playerUserIds.length < 2 || playerUserIds.length > 6) {
      throw new Error('玩家数量需在 2-6 之间');
    }

    const deck = shuffle(this.createDeck());

    // 平均发牌
    const numPlayers = playerUserIds.length;
    const players: WangbaPlayerHand[] = playerUserIds.map((userId, i) => ({
      userId,
      handCards: [],
      discardPairs: [],
    }));

    deck.forEach((card, i) => {
      players[i % numPlayers].handCards.push(card);
    });

    // 初始配对
    const eliminatedPlayerIds: string[] = [];
    for (const player of players) {
      const { handCards, discardPairs } = this.removePairs(player.handCards);
      player.handCards = handCards;
      player.discardPairs = discardPairs;
      // Bug 1: 初始手牌为空的玩家立即胜出
      if (handCards.length === 0) {
        eliminatedPlayerIds.push(player.userId);
      }
    }

    const state: WangbaGameState = {
      players,
      currentPlayerIndex: 0,
      eliminatedPlayerIds,
      phase: 'DRAWING',
      drawMode,
    };

    // Bug 2: 跳过初始无手牌或已淘汰的玩家
    this.skipToValidPlayer(state);

    return state;
  }

  /**
   * 执行抽牌操作
   * @param state 当前游戏状态
   * @param drawingPlayerId 抽牌者 userId
   * @param targetPlayerId 被抽牌者 userId
   */
  drawCard(state: WangbaGameState, drawingPlayerId: string, targetPlayerId: string): {
    result: WangbaDrawResult;
    newState: WangbaGameState;
    gameOver?: WangbaGameOverResult;
  } {
    // 验证阶段
    if (state.phase === 'FINISHED') {
      throw new Error('游戏已结束');
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.userId !== drawingPlayerId) {
      throw new Error('还没轮到你抽牌');
    }
    if (currentPlayer.handCards.length === 0) {
      throw new Error('你手中没有牌了');
    }

    const targetPlayer = state.players.find(p => p.userId === targetPlayerId);
    if (!targetPlayer) {
      throw new Error('目标玩家不存在');
    }
    if (state.eliminatedPlayerIds.includes(targetPlayerId)) {
      throw new Error('目标玩家已胜出，不能从其手中抽牌');
    }
    if (targetPlayer.userId === drawingPlayerId) {
      throw new Error('不能从自己手中抽牌');
    }
    if (targetPlayer.handCards.length === 0) {
      throw new Error('目标玩家手中没有牌');
    }

    // neighbor 模式: 只能从下家抽牌
    if (state.drawMode === 'neighbor') {
      const n = state.players.length;
      // 顺时针找下一个未淘汰且有手牌的玩家
      let nextIdx = (state.currentPlayerIndex + 1) % n;
      let found = false;
      for (let i = 0; i < n; i++) {
        const p = state.players[nextIdx];
        if (!state.eliminatedPlayerIds.includes(p.userId) && p.handCards.length > 0) {
          found = true;
          break;
        }
        nextIdx = (nextIdx + 1) % n;
      }
      if (!found || state.players[nextIdx].userId !== targetPlayerId) {
        throw new Error('当前模式下只能从下家手中抽牌');
      }
    }

    // 随机抽取一张牌
    const randomIndex = Math.floor(Math.random() * targetPlayer.handCards.length);
    const drawnCard = targetPlayer.handCards[randomIndex];

    // 深拷贝 state (简化为 JSON 序列化)
    const newState: WangbaGameState = JSON.parse(JSON.stringify(state));

    // 从目标玩家手牌中移除
    const targetInNew = newState.players.find(p => p.userId === targetPlayerId)!;
    targetInNew.handCards.splice(randomIndex, 1);

    // 加入抽牌者手牌
    const drawingInNew = newState.players.find(p => p.userId === drawingPlayerId)!;
    drawingInNew.handCards.push(drawnCard);

    // 检查是否形成新对子
    const { handCards, discardPairs } = this.removePairs(drawingInNew.handCards);

    // 通过比对旧的对子列表，找出新增的对子（包含 drawnCard 的对子）
    let newPair: [WangbaCard, WangbaCard] | undefined;
    if (discardPairs.length > drawingInNew.discardPairs.length) {
      // 在 discardPairs 中找包含 drawnCard 的对子即为新配对
      const found = discardPairs.find(
        pair => pair[0].id === drawnCard.id || pair[1].id === drawnCard.id,
      );
      newPair = found || discardPairs[discardPairs.length - 1];
    }

    drawingInNew.handCards = handCards;
    drawingInNew.discardPairs = discardPairs;

    // 检查抽牌者是否清空手牌
    let eliminatedPlayerId: string | undefined;
    if (handCards.length === 0) {
      eliminatedPlayerId = drawingPlayerId;
      newState.eliminatedPlayerIds.push(drawingPlayerId);
    }

    const result: WangbaDrawResult = {
      drawingPlayerId,
      targetPlayerId,
      drawnCard,
      newPair,
      eliminatedPlayerId,
    };

    // 检查游戏是否结束
    let gameOver: WangbaGameOverResult | undefined;

    // 计算剩余未淘汰玩家
    const remainingPlayers = newState.players.filter(
      p => !newState.eliminatedPlayerIds.includes(p.userId) && p.handCards.length > 0,
    );

    if (remainingPlayers.length <= 1) {
      newState.phase = 'FINISHED';

      // Bug 4: 在修改 eliminatedPlayerIds 之前收集赢家列表
      const winnerIds = [...newState.eliminatedPlayerIds];

      // 最后有牌的玩家 (或所有剩余牌所在) 是输家
      // 找出仍持有小王的玩家作为最终输家
      let loserId: string;
      if (remainingPlayers.length === 1) {
        loserId = remainingPlayers[0].userId;
      } else {
        // 所有非淘汰玩家手牌都为空但还有未被标记淘汰的，找持有小王的
        const allRemaining = newState.players.filter(
          p => !newState.eliminatedPlayerIds.includes(p.userId),
        );
        const holder = allRemaining.find(p =>
          p.handCards.some(c => c.id === 'small_joker'),
        );
        loserId = holder?.userId || allRemaining[allRemaining.length - 1]?.userId;
      }

      // 确保输家也被记录在 eliminatedPlayerIds 中
      if (!newState.eliminatedPlayerIds.includes(loserId)) {
        newState.eliminatedPlayerIds.push(loserId);
      }

      newState.loserId = loserId;

      gameOver = {
        loserId,
        winnerIds,
        reason: EndReason.LAST_CARD,
      };
    } else if (eliminatedPlayerId) {
      // Bug 3: 有人胜出但游戏未结束，推进到下一个有效玩家
      this.advanceTurn(newState);
      this.skipToValidPlayer(newState);
    } else {
      // 正常推进回合
      this.advanceTurn(newState);

      // 跳过已淘汰或无手牌的玩家
      this.skipToValidPlayer(newState);
    }

    return { result, newState, gameOver };
  }

  /** 推进 currentPlayerIndex 到下一位 */
  private advanceTurn(state: WangbaGameState): void {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  }

  /** 跳过已淘汰或无手牌的玩家 */
  private skipToValidPlayer(state: WangbaGameState): void {
    const n = state.players.length;
    let count = 0;
    while (count < n) {
      const p = state.players[state.currentPlayerIndex];
      if (!state.eliminatedPlayerIds.includes(p.userId) && p.handCards.length > 0) {
        break;
      }
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % n;
      count++;
    }
  }

  /**
   * 为客户端生成同步数据 (仅包含该玩家可见的手牌)
   */
  getSyncData(state: WangbaGameState, userId: string, nicknames: Map<string, string>) {
    const myPlayer = state.players.find(p => p.userId === userId);

    return {
      gameType: 'WANGBA' as const,
      myHand: myPlayer?.handCards || [],
      myDiscards: myPlayer?.discardPairs || [],
      players: state.players.map(p => ({
        userId: p.userId,
        nickname: nicknames.get(p.userId) || '未知',
        handCount: p.handCards.length,
        discardCount: p.discardPairs.length,
        eliminated: state.eliminatedPlayerIds.includes(p.userId),
      })),
      currentPlayerIndex: state.currentPlayerIndex,
      phase: state.phase,
      eliminatedPlayers: state.eliminatedPlayerIds,
      loserId: state.loserId,
      drawMode: state.drawMode,
    };
  }
}
