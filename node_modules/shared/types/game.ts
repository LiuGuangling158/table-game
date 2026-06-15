// ==================== 游戏类型 ====================

import { UserStatus } from './user';

export enum GameType {
  GOMOKU = 'GOMOKU',
  XIANGQI = 'XIANGQI',
  CHESS = 'CHESS',
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
}

export enum EndReason {
  CHECKMATE = 'CHECKMATE',
  STALEMATE = 'STALEMATE',
  FIVE_IN_ROW = 'FIVE_IN_ROW',
  RESIGN = 'RESIGN',
  DRAW = 'DRAW',
  TIMEOUT = 'TIMEOUT',
  DISCONNECT = 'DISCONNECT',
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
