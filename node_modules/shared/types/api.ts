// API 请求/响应类型

import { GameType, RoomStatus, PlayerColor, EndReason } from './game';

// ==================== 通用 ====================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== 认证 ====================
export interface LoginRequest {
  code: string;
  platform: 'wechat' | 'qq';
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
    oauthPlatform: string | null;
    status: string;
  };
}

export interface OAuthUrlResponse {
  url: string;
  state: string;
}

// ==================== 用户 ====================
export interface UpdateProfileRequest {
  nickname?: string;
  avatar?: string;
}

// ==================== 好友 ====================
export interface SendFriendRequest {
  receiverId: string;
  message?: string;
}

// ==================== 游戏房间 ====================
export interface CreateRoomRequest {
  gameType: GameType;
  maxPlayers?: number;
}

export interface JoinRoomRequest {
  roomId: string;
  color?: PlayerColor;
}
