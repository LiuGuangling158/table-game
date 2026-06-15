export const GAME_TYPES = {
  GOMOKU: 'GOMOKU' as const,
  XIANGQI: 'XIANGQI' as const,
  CHESS: 'CHESS' as const,
} as const;

export const GAME_TYPE_LABELS: Record<string, string> = {
  GOMOKU: '五子棋',
  XIANGQI: '中国象棋',
  CHESS: '国际象棋',
};

export const GAME_TYPE_CONFIGS = {
  GOMOKU: { boardRows: 15, boardCols: 15, label: '五子棋', maxPlayers: 2 },
  XIANGQI: { boardRows: 10, boardCols: 9, label: '中国象棋', maxPlayers: 2 },
  CHESS: { boardRows: 8, boardCols: 8, label: '国际象棋', maxPlayers: 2 },
} as const;
