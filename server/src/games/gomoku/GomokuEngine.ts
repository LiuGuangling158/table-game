import { GameEngine } from '../base/GameEngine';
import { BoardState, Move, MoveResult, GameOverResult, Position, PlayerColor, GameType, EndReason } from 'shared';

export class GomokuEngine extends GameEngine {
  readonly gameType = GameType.GOMOKU;
  readonly boardRows = 15;
  readonly boardCols = 15;

  getInitialState(): BoardState {
    return {
      board: Array.from({ length: this.boardRows }, () =>
        Array.from({ length: this.boardCols }, () => null)
      ),
      currentPlayer: PlayerColor.BLACK,
      moveCount: 0,
    };
  }

  getLegalMoves(state: BoardState, _position: Position): Position[] {
    // 五子棋中，所有空位都是合法走法
    const moves: Position[] = [];
    for (let r = 0; r < this.boardRows; r++) {
      for (let c = 0; c < this.boardCols; c++) {
        if (state.board[r][c] === null) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  validateMove(state: BoardState, move: Move): MoveResult {
    const { to } = move;

    // 校验回合：客户端传来的 piece 必须匹配当前玩家颜色
    const expectedPiece = this.getPieceNotation(state.currentPlayer);
    if (!move.piece || move.piece !== expectedPiece) {
      return { valid: false, message: '不是你的回合' };
    }

    // 先检查是否在棋盘范围内 (防止越界崩溃)
    if (!this.isInBounds(to)) {
      return { valid: false, message: '超出棋盘范围' };
    }

    // 检查目标位置是否为空
    if (state.board[to.row][to.col] !== null) {
      return { valid: false, message: '该位置已有棋子' };
    }

    return { valid: true };
  }

  applyMove(state: BoardState, move: Move): BoardState {
    const pieceNotation = this.getPieceNotation(state.currentPlayer);
    const newBoard = this.setPiece(state.board, move.to, pieceNotation);

    return {
      ...this.switchPlayer(state),
      board: newBoard,
      lastMove: { from: move.to, to: move.to },
    };
  }

  checkGameOver(state: BoardState): GameOverResult | null {
    // 仅从最后落子位置检查五连（优化：O(1) 替代 O(n²) 全盘扫描）
    const lastMove = state.lastMove;
    if (lastMove) {
      const lastPlayer = this.getNextPlayer(state.currentPlayer);
      if (this.checkFiveInRow(state.board, lastMove.to.row, lastMove.to.col)) {
        return {
          winner: lastPlayer,
          reason: EndReason.FIVE_IN_ROW,
          finalState: state,
        };
      }
    }

    // 检查是否平局(棋盘满)
    const hasEmpty = state.board.some(row => row.some(cell => cell === null));
    if (!hasEmpty) {
      return {
        winner: null,
        reason: EndReason.DRAW,
        finalState: state,
      };
    }

    return null;
  }

  private checkFiveInRow(board: (string | null)[][], row: number, col: number): boolean {
    const piece = board[row][col];
    if (!piece) return false;

    const directions = [
      [0, 1],   // 水平
      [1, 0],   // 垂直
      [1, 1],   // 正斜
      [1, -1],  // 反斜
    ];

    for (const [dr, dc] of directions) {
      let count = 1;

      // 正方向
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (this.isInBounds({ row: r, col: c }) && board[r][c] === piece) {
          count++;
        } else {
          break;
        }
      }

      // 反方向
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (this.isInBounds({ row: r, col: c }) && board[r][c] === piece) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) return true;
    }

    return false;
  }

  private getPieceNotation(player: PlayerColor): string {
    return player === PlayerColor.BLACK ? 'B' : 'W';
  }
}
