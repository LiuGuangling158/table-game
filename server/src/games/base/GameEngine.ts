import { BoardState, Move, MoveResult, GameOverResult, Position, PlayerColor, GameType, EndReason } from 'shared';

export abstract class GameEngine {
  abstract readonly gameType: GameType;
  abstract readonly boardRows: number;
  abstract readonly boardCols: number;

  /** 获取初始棋盘状态 */
  abstract getInitialState(): BoardState;

  /** 获取某位置的所有合法目标位置 */
  abstract getLegalMoves(state: BoardState, position: Position): Position[];

  /** 验证走法是否合法 */
  abstract validateMove(state: BoardState, move: Move): MoveResult;

  /** 执行走法，返回新状态 (注意：不修改原状态) */
  abstract applyMove(state: BoardState, move: Move): BoardState;

  /** 检查游戏是否结束 */
  abstract checkGameOver(state: BoardState): GameOverResult | null;

  /** 获取当前轮到谁 */
  getCurrentPlayer(state: BoardState): PlayerColor {
    return state.currentPlayer;
  }

  /** 切换玩家 */
  protected switchPlayer(state: BoardState): BoardState {
    const nextPlayer = this.getNextPlayer(state.currentPlayer);
    return {
      ...state,
      currentPlayer: nextPlayer,
      moveCount: state.moveCount + 1,
    };
  }

  /** 获取下一个玩家颜色 */
  public getNextPlayer(current: PlayerColor): PlayerColor {
    switch (this.gameType) {
      case GameType.GOMOKU:
        return current === PlayerColor.BLACK ? PlayerColor.WHITE : PlayerColor.BLACK;
      case GameType.CHESS:
        return current === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
      case GameType.XIANGQI:
        return current === PlayerColor.RED ? PlayerColor.BLUE : PlayerColor.RED;
      default:
        return current;
    }
  }

  /** 深度克隆棋盘 */
  protected cloneBoard(board: (string | null)[][]): (string | null)[][] {
    return board.map(row => [...row]);
  }

  /** 检查位置是否在棋盘内 */
  protected isInBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < this.boardRows && pos.col >= 0 && pos.col < this.boardCols;
  }

  /** 获取棋盘上某位置的棋子 */
  protected getPiece(board: (string | null)[][], pos: Position): string | null {
    if (!this.isInBounds(pos)) return null;
    return board[pos.row][pos.col];
  }

  /** 设置棋盘上某位置的棋子(返回新棋盘) */
  protected setPiece(board: (string | null)[][], pos: Position, piece: string | null): (string | null)[][] {
    const newBoard = this.cloneBoard(board);
    newBoard[pos.row][pos.col] = piece;
    return newBoard;
  }

  /** 判断棋子颜色 — 大写=先手方 (Gomoku:BLACK, Chess:WHITE, Xiangqi:RED) */
  protected getPieceColor(piece: string): PlayerColor {
    const isUpper = piece === piece.toUpperCase();
    if (isUpper) {
      if (this.gameType === GameType.XIANGQI) return PlayerColor.RED;
      if (this.gameType === GameType.GOMOKU) return PlayerColor.BLACK;
      return PlayerColor.WHITE; // CHESS
    } else {
      if (this.gameType === GameType.XIANGQI) return PlayerColor.BLUE;
      if (this.gameType === GameType.GOMOKU) return PlayerColor.WHITE;
      return PlayerColor.BLACK; // CHESS
    }
  }

  /** 获取某方所有合法走法 (供前端高亮显示) */
  getAllValidMoves(state: BoardState, color: PlayerColor): Array<{ from: Position; to: Position }> {
    const results: Array<{ from: Position; to: Position }> = [];
    for (let r = 0; r < this.boardRows; r++) {
      for (let c = 0; c < this.boardCols; c++) {
        const piece = state.board[r][c];
        if (piece && this.getPieceColor(piece) === color) {
          const from = { row: r, col: c };
          const candidateMoves = this.getLegalMoves(state, from);
          for (const to of candidateMoves) {
            const move: Move = { from, to, piece };
            if (this.validateMove(state, move).valid) {
              results.push({ from, to });
            }
          }
        }
      }
    }
    return results;
  }

  /** 执行一次完整的走棋(验证 + 执行 + 检查结束) */
  makeMove(state: BoardState, move: Move): MoveResult {
    // 验证走法
    const validation = this.validateMove(state, move);
    if (!validation.valid) {
      return validation;
    }

    // 执行走法
    const newState = this.applyMove(state, move);

    // 检查游戏结束
    const gameOver = this.checkGameOver(newState);

    return {
      valid: true,
      newState,
      captured: validation.captured,
      isCheck: newState.inCheck != null,
      isCheckmate: gameOver ? gameOver.reason === EndReason.CHECKMATE || gameOver.reason === EndReason.FIVE_IN_ROW : false,
      isStalemate: gameOver ? gameOver.reason === EndReason.STALEMATE || gameOver.reason === EndReason.DRAW : false,
    };
  }
}
