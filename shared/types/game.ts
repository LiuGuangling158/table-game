// ==================== 游戏类型 ====================

import { UserStatus } from './user';

export enum GameType {
  GOMOKU = 'GOMOKU',
  XIANGQI = 'XIANGQI',
  CHESS = 'CHESS',
  WANGBA = 'WANGBA',
}

export enum RoomStatus {
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum PlayerColor {
  BLACK = 'BLACK',
  WHITE = 'WHITE',
  RED = 'RED',
  BLUE = 'BLUE',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  PURPLE = 'PURPLE',
}

export enum EndReason {
  CHECKMATE = 'CHECKMATE',
  STALEMATE = 'STALEMATE',
  FIVE_IN_ROW = 'FIVE_IN_ROW',
  RESIGN = 'RESIGN',
  DRAW = 'DRAW',
  TIMEOUT = 'TIMEOUT',
  DISCONNECT = 'DISCONNECT',
  LAST_CARD = 'LAST_CARD',
}

// 棋盘位置
export interface Position {
  row: number;
  col: number;
}

// 走法
export interface Move {
  from: Position;
  to: Position;
  piece: string;
  captured?: string;
  promotion?: string; // 国际象棋兵升变
}

// 走法结果
export interface MoveResult {
  valid: boolean;
  message?: string;
  newState?: BoardState;
  captured?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
}

// 棋盘状态
export interface BoardState {
  board: (string | null)[][];
  currentPlayer: PlayerColor;
  moveCount: number;
  // 国际象棋特殊状态
  castlingRights?: {
    whiteKingSide: boolean;
    whiteQueenSide: boolean;
    blackKingSide: boolean;
    blackQueenSide: boolean;
  };
  enPassantTarget?: Position | null;
  // 中国象棋特殊状态
  inCheck?: PlayerColor | null;
  // 最后一步走法位置 (用于高亮和终局优化)
  lastMove?: { from: Position; to: Position } | null;
}

// 游戏结束结果
export interface GameOverResult {
  winner: PlayerColor | null; // null = 平局
  reason: EndReason;
  finalState: BoardState;
}

// 游戏配置
export interface GameConfig {
  gameType: GameType;
  boardRows: number;
  boardCols: number;
  timeLimit?: number; // 每步限时(秒)
  totalTime?: number; // 总局时(秒)
}

// ==================== 房间类型 ====================

export interface GameRoomInfo {
  id: string;
  gameType: GameType;
  status: RoomStatus;
  maxPlayers: number;
  hostId: string;
  players: RoomPlayer[];
  createdAt: string;
}

export interface RoomPlayer {
  userId: string;
  nickname: string;
  avatar: string | null;
  color: PlayerColor;
  ready: boolean;
}

// ==================== 好友类型 ====================

export enum RequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export interface FriendRequestInfo {
  id: string;
  senderId: string;
  senderNickname: string;
  senderAvatar: string | null;
  receiverId: string;
  status: RequestStatus;
  message: string | null;
  createdAt: string;
}

export interface FriendInfo {
  userId: string;
  nickname: string;
  avatar: string | null;
  status: UserStatus;
  since: string;
}

// ==================== 游戏记录类型 ====================

export interface GameRecordInfo {
  id: string;
  gameType: GameType;
  players: {
    userId: string;
    nickname: string;
    color: PlayerColor;
  }[];
  winnerId: string | null;
  reason: EndReason;
  duration: number | null;
  moves: GameMoveInfo[];
  createdAt: string;
}

export interface GameMoveInfo {
  moveNumber: number;
  userId: string;
  moveData: Move;
  createdAt: string;
}

// ==================== 抽王八 (卡牌游戏) 类型 ====================

/** 扑克牌花色 */
export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

/** 扑克牌点数 */
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

/** 抽王八抽牌模式 */
export type WangbaDrawMode = 'any' | 'neighbor';

/** 单张扑克牌 */
export interface WangbaCard {
  suit: CardSuit | 'joker';
  rank: CardRank | 'small_joker' | 'big_joker';
  id: string; // 唯一标识
}

/** 抽王八玩家视角数据 (不含手牌详情) */
export interface WangbaPlayerView {
  userId: string;
  nickname: string;
  handCount: number;      // 手牌数量 (对手不可见具体手牌)
  discardCount: number;   // 已消除的对子数
  eliminated: boolean;    // 是否已出完牌(胜出)
}

/** 抽王八完整游戏状态 (服务端内部) */
export interface WangbaGameState {
  players: WangbaPlayerHand[];
  currentPlayerIndex: number;
  eliminatedPlayerIds: string[]; // 按胜出顺序
  loserId?: string;
  phase: 'DEALING' | 'DRAWING' | 'FINISHED';
  drawMode: WangbaDrawMode;
}

/** 玩家手牌 + 消除对子 (服务端内部) */
export interface WangbaPlayerHand {
  userId: string;
  handCards: WangbaCard[];     // 手中剩余的牌
  discardPairs: [WangbaCard, WangbaCard][]; // 已配对的牌
}

/** 抽王八走法 (客户端发出) */
export interface WangbaDrawMove {
  roomId: string;
  targetPlayerId: string; // 从哪位玩家手中抽牌
}

/** 抽王八走法结果 (服务端广播) */
export interface WangbaDrawResult {
  drawingPlayerId: string;
  targetPlayerId: string;
  drawnCard: WangbaCard;
  newPair?: [WangbaCard, WangbaCard]; // 如果抽到后形成了对子
  eliminatedPlayerId?: string; // 如果抽牌者手牌清空，则胜出
}

/** 抽王八游戏同步数据 (发送给特定玩家，含手牌) */
export interface WangbaSyncData {
  gameType: 'WANGBA';
  myHand: WangbaCard[];           // 自己的手牌 (仅自己可见)
  myDiscards: [WangbaCard, WangbaCard][];
  players: WangbaPlayerView[];    // 所有玩家公开信息
  currentPlayerIndex: number;
  phase: 'DEALING' | 'DRAWING' | 'FINISHED';
  eliminatedPlayers: string[];    // 已胜出玩家 userId 列表
  loserId?: string;
  drawMode: WangbaDrawMode;
}

/** 抽王八游戏结束结果 */
export interface WangbaGameOverResult {
  loserId: string;               // 最后拿王八的人
  winnerIds: string[];           // 其他所有玩家
  reason: EndReason;
}
