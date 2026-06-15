// WebSocket 事件名称常量

export const SocketEvents = {
  // 连接管理
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',

  // 大厅
  LOBBY_ROOMS: 'lobby:rooms',
  LOBBY_ROOM_CREATED: 'lobby:room_created',
  LOBBY_ROOM_CLOSED: 'lobby:room_closed',

  // 房间
  ROOM_JOIN: 'room:join',
  ROOM_JOINED: 'room:joined',
  ROOM_PLAYER_JOINED: 'room:player_joined',
  ROOM_LEAVE: 'room:leave',
  ROOM_PLAYER_LEFT: 'room:player_left',
  ROOM_READY: 'room:ready',
  ROOM_GAME_START: 'room:game_start',
  ROOM_INVITE: 'room:invite',

  // 游戏内
  GAME_MOVE: 'game:move',
  GAME_MOVE_RESULT: 'game:move_result',
  GAME_TURN: 'game:turn',
  GAME_OVER: 'game:over',
  GAME_RESIGN: 'game:resign',
  GAME_DRAW_REQUEST: 'game:draw_request',
  GAME_DRAW_RESPONSE: 'game:draw_response',
  GAME_CHAT: 'game:chat',
  GAME_SYNC: 'game:sync',
  GAME_TIMER_SYNC: 'game:timer_sync',

  // 通知
  NOTIFY_FRIEND_REQUEST: 'notify:friend_request',
  NOTIFY_GAME_INVITE: 'notify:game_invite',
  NOTIFY_ERROR: 'notify:error',
} as const;

// Socket 事件 Payload 类型
export interface SocketPayloads {
  'room:join': { roomId: string };
  'room:joined': { room: import('./game').GameRoomInfo };
  'room:player_joined': { userId: string; nickname: string };
  'room:leave': { roomId: string };
  'room:player_left': { userId: string };
  'room:ready': { roomId: string };
  'room:game_start': { gameState: import('./game').BoardState; firstPlayer: import('./game').PlayerColor };
  'room:invite': { targetUserId: string; gameType: import('./game').GameType };
  'game:move': { roomId: string; move: import('./game').Move };
  'game:move_result': { valid: boolean; move: import('./game').Move; newState: import('./game').BoardState; captured?: string; isCheck?: boolean };
  'game:turn': { currentPlayer: import('./game').PlayerColor; remainingTime?: number; legalMoves?: Array<{ from: [number, number]; to: [number, number] }> };
  'game:over': { winner: import('./game').PlayerColor | null; reason: import('./game').EndReason; finalState: import('./game').BoardState };
  'game:resign': { roomId: string };
  'game:draw_request': { roomId: string };
  'game:draw_response': { roomId: string; accept: boolean };
  'game:chat': { roomId: string; message: string };
  'game:sync': { fullState: import('./game').BoardState; currentPlayer: import('./game').PlayerColor; timeRemaining?: number; legalMoves?: Array<{ from: [number, number]; to: [number, number] }> };
  'game:timer_sync': { timeRemaining: Record<string, number> };
  'notify:friend_request': { fromUser: { id: string; nickname: string; avatar: string | null }; message: string | null };
  'notify:game_invite': { fromUser: { id: string; nickname: string; avatar: string | null }; roomId: string; gameType: import('./game').GameType };
  'notify:error': { code: string; message: string };
  'lobby:rooms': import('./game').GameRoomInfo[];
  'lobby:room_created': import('./game').GameRoomInfo;
  'lobby:room_closed': { roomId: string };
  'user:online': { userId: string };
  'user:offline': { userId: string };
}
