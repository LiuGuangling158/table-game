# Table Games — 在线桌游平台

## 项目结构

```
client/          React 18 + Vite + Zustand + Tailwind
server/          Express + Socket.IO + Prisma + PostgreSQL
shared/          共享类型/常量 (3项目共用)
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18, react-router-dom v6, Zustand, Socket.IO Client, Tailwind CSS, Canvas |
| 后端 | Express 4, `express-async-errors`, Socket.IO 4, Prisma 5, JWT (jsonwebtoken), bcryptjs |
| 数据库 | PostgreSQL 16 (docker-compose) |
| 共享 | TypeScript 枚举/接口/常量 (GameType, BoardState, Move, ERROR_CODES...) |

## 启动方式

```bash
docker-compose up -d              # PostgreSQL
npm run db:migrate                # Prisma 迁移
npm run dev                       # concurrently 启动 client:5173 + server:3001
```

Vite 代理 `/api` 和 `/socket.io` → `localhost:3001`。

## 核心架构

### 游戏引擎 (策略模式)

```
GameEngine (abstract)
├── GomokuEngine   15×15  B/W
├── XiangqiEngine  10×9   红(RED大写)/蓝(blue小写)
└── ChessEngine     8×8   白(大写)/黑(小写)

引擎方法: getInitialState → validateMove → applyMove → checkGameOver
统一入口: makeMove() = validate + apply + checkGameOver
```

- 棋子颜色规则：大写=先手方 (Xiangqi: RED, Chess: WHITE, Gomoku: BLACK)
- `getPieceColor()` 在 GameEngine 基类中统一实现
- `getNextPlayer()` 按游戏类型返回对手颜色

### 游戏流程

```
LoginPage → HomePage → createRoom(API) → /room/:id
→ room:join(socket) → 双方ready → 3秒倒计时 → game_start
→ /play/:id → game:init → game:sync → 走棋 → game:over
```

### 关键数据结构

```typescript
// shared/types/game.ts
BoardState { board: (string|null)[][], currentPlayer, moveCount, castlingRights?, enPassantTarget?, inCheck? }
Move { from: Position, to: Position, piece, captured?, promotion? }

// server — 活跃游戏
ActiveGame { engine: GameEngine, state: BoardState, playerUsers: Map<color, userId> }
```

### Socket 事件命名约定

```
lobby:*    大厅 (get_rooms, rooms, room_updated)
room:*     房间 (join, leave, ready, player_joined, game_start)
game:*     游戏 (init, move, move_result, turn, over, resign, draw_*, sync, chat)
notify:*   通知 (error, info, game_invite, friend_request)
user:*     用户状态 (online, offline)
```

### 路由中间件

- `authMiddleware` — 强制 Bearer JWT 验证 (挂载 `req.user`)
- `errorHandler` — 捕获 `AppError` 统一返回 `{success, error, message}`
- Socket.IO 认证中间件：验证 handshake.auth.token JWT → 挂载 `socket.user`

## 重要约定

1. **PrismaClient 分散** — 每个 service 文件独立 `new PrismaClient()` (可优化为单例)
2. **JWT 签发** — `signToken({userId, nickname})` 同时返回 accessToken + refreshToken
3. **错误处理** — `throw new AppError(statusCode, ERROR_CODE, message)` 由 errorHandler 统一捕获
4. **Socket 用户信息** — 通过 `(socket as any).user` 访问 `{userId, nickname}`
5. **客户端 Socket 访问** — `(window as any).__socket` / `(window as any).__currentRoomId`
6. **五子棋走法** — `from === to` (落子即走法)，`piece` 用于回合校验
7. **象棋引擎** — `getLegalMoves` 不含将军校验 (由 `validateMove` 模拟走法后判断)
8. **国际象棋引擎** — `getLegalMoves` 含将军+易位校验，`applyMove` 处理升变/过路兵/易位

## 已知设计决策

- 开发模式登录: `POST /api/auth/dev/login` 每次生成新 openId (非持久)；微信/QQ OAuth 代码已移除
- 自动开始: 双方 ready 后 3 秒倒计时服务端自动 startGame
- 游戏状态存在内存 (`activeGames` Map)，服务重启丢失
- `shared.EndReason` vs `@prisma/client.EndReason` 同值不同型，用 `as any` 桥接
