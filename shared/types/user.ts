export enum UserStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IN_GAME = 'IN_GAME',
}

export interface UserInfo {
  id: string;
  nickname: string;
  avatar: string | null;
  oauthPlatform: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface UserPublicInfo {
  id: string;
  nickname: string;
  avatar: string | null;
  status: UserStatus;
}
