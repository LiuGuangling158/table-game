import { GameEngine } from '../base/GameEngine';
import { BoardState, Move, MoveResult, GameOverResult, Position, PlayerColor, GameType, EndReason } from 'shared';

/**
 * 中国象棋引擎
 *
 * 棋盘: 9列×10行
 * 红方在下方 (row 9-0, 实际排列为 row 5-9 红方底, row 0-4 黑方底)
 *   约定: row 0-4 为黑方半场(蓝), row 5-9 为红方半场
 *
 * 棋子表示:
 *   红方(大写): K=帅, G=仕, E=相, H=馬, R=車, C=炮, P=兵
 *   黑方(小写): k=将, g=士, e=象, h=马, r=车, c=砲, p=卒
 */
export class XiangqiEngine extends GameEngine {
  readonly gameType = GameType.XIANGQI;
  readonly boardRows = 10;
  readonly boardCols = 9;

  getInitialState(): BoardState {
    const board: (string | null)[][] = Array.from({ length: 10 }, () => Array(9).fill(null));

    // 黑方(上方 row 0-4)
    board[0][0] = 'r'; board[0][1] = 'h'; board[0][2] = 'e'; board[0][3] = 'g'; board[0][4] = 'k';
    board[0][5] = 'g'; board[0][6] = 'e'; board[0][7] = 'h'; board[0][8] = 'r';
    board[2][1] = 'c'; board[2][7] = 'c';
    board[3][0] = 'p'; board[3][2] = 'p'; board[3][4] = 'p'; board[3][6] = 'p'; board[3][8] = 'p';

    // 红方(下方 row 5-9)
    board[9][0] = 'R'; board[9][1] = 'H'; board[9][2] = 'E'; board[9][3] = 'G'; board[9][4] = 'K';
    board[9][5] = 'G'; board[9][6] = 'E'; board[9][7] = 'H'; board[9][8] = 'R';
    board[7][1] = 'C'; board[7][7] = 'C';
    board[6][0] = 'P'; board[6][2] = 'P'; board[6][4] = 'P'; board[6][6] = 'P'; board[6][8] = 'P';

    return {
      board,
      currentPlayer: PlayerColor.RED, // 红方先走
      moveCount: 0,
      inCheck: null,
    };
  }

  getLegalMoves(state: BoardState, position: Position): Position[] {
    const piece = this.getPiece(state.board, position);
    if (!piece) return [];

    const color = this.getPieceColor(piece);
    const pieceType = piece.toUpperCase();

    switch (pieceType) {
      case 'K': return this.getKingMoves(state.board, position, color);
      case 'G': return this.getAdvisorMoves(state.board, position, color);
      case 'E': return this.getElephantMoves(state.board, position, color);
      case 'H': return this.getHorseMoves(state.board, position, color);
      case 'R': return this.getRookMoves(state.board, position, color);
      case 'C': return this.getCannonMoves(state.board, position, color);
      case 'P': return this.getPawnMoves(state.board, position, color);
      default: return [];
    }
  }

  validateMove(state: BoardState, move: Move): MoveResult {
    const { from, to } = move;
    const piece = this.getPiece(state.board, from);

    if (!piece) {
      return { valid: false, message: '该位置没有棋子' };
    }

    const pieceColor = this.getPieceColor(piece);
    if (pieceColor !== state.currentPlayer) {
      return { valid: false, message: '不是你的棋子' };
    }

    // 检查目标位置是否是己方棋子
    const targetPiece = this.getPiece(state.board, to);
    if (targetPiece && this.getPieceColor(targetPiece) === pieceColor) {
      return { valid: false, message: '不能吃己方棋子' };
    }

    const legalMoves = this.getLegalMoves(state, from);
    const isLegalMove = legalMoves.some(m => m.row === to.row && m.col === to.col);

    if (!isLegalMove) {
      return { valid: false, message: '不符合该棋子的走法规则' };
    }

    // 模拟走法，检查是否造成己方被将
    const simState = this.simulateMove(state, move);
    if (this.isInCheck(simState, pieceColor)) {
      return { valid: false, message: '走棋后己方将被将军' };
    }

    // 检查将帅照面
    if (this.kingsAreFacing(simState)) {
      return { valid: false, message: '将帅不能照面' };
    }

    const captured = targetPiece || undefined;

    return { valid: true, captured };
  }

  applyMove(state: BoardState, move: Move): BoardState {
    const piece = this.getPiece(state.board, move.from);
    if (!piece) {
      throw new Error(`XiangqiEngine.applyMove: 位置 (${move.from.row},${move.from.col}) 无棋子`);
    }
    let newBoard = this.setPiece(state.board, move.from, null);
    newBoard = this.setPiece(newBoard, move.to, piece);

    // 检查是否将军
    const nextColor = state.currentPlayer;
    const opponentColor = nextColor === PlayerColor.RED ? PlayerColor.BLUE : PlayerColor.RED;
    const newState: BoardState = {
      ...this.switchPlayer(state),
      board: newBoard,
      lastMove: { from: move.from, to: move.to },
    };

    if (this.isInCheck(newState, opponentColor)) {
      newState.inCheck = opponentColor;
    } else {
      newState.inCheck = null;
    }

    return newState;
  }

  checkGameOver(state: BoardState): GameOverResult | null {
    const currentPlayer = state.currentPlayer;

    // 检查当前玩家是否有合法走法
    if (this.isCheckmated(state, currentPlayer)) {
      const winner = currentPlayer === PlayerColor.RED ? PlayerColor.BLUE : PlayerColor.RED;
      // 区分将杀和被"困毙"(无子可走但未被将军)
      const inCheck = this.isInCheck(state, currentPlayer);
      return {
        winner,
        reason: inCheck ? EndReason.CHECKMATE : EndReason.STALEMATE,
        finalState: state,
      };
    }

    return null;
  }

  // ==================== 各棋子走法 ====================

  private getKingMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // 帅/将在九宫内活动
    const [minRow, maxRow] = color === PlayerColor.RED ? [7, 9] : [0, 2];
    const [minCol, maxCol] = [3, 5];

    for (const [dr, dc] of directions) {
      const newRow = pos.row + dr;
      const newCol = pos.col + dc;
      if (newRow >= minRow && newRow <= maxRow && newCol >= minCol && newCol <= maxCol) {
        const target = this.getPiece(board, { row: newRow, col: newCol });
        if (!target || this.getPieceColor(target) !== color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }

    return moves;
  }

  private getAdvisorMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    const [minRow, maxRow] = color === PlayerColor.RED ? [7, 9] : [0, 2];
    const [minCol, maxCol] = [3, 5];

    for (const [dr, dc] of directions) {
      const newRow = pos.row + dr;
      const newCol = pos.col + dc;
      if (newRow >= minRow && newRow <= maxRow && newCol >= minCol && newCol <= maxCol) {
        const target = this.getPiece(board, { row: newRow, col: newCol });
        if (!target || this.getPieceColor(target) !== color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }

    return moves;
  }

  private getElephantMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    // 走"田"字: 对角线两格，检查象眼
    const eyeOffsets = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // 象眼位置
    const moveOffsets = [[-2, -2], [-2, 2], [2, -2], [2, 2]];

    // 不能过河
    const maxRow = color === PlayerColor.RED ? 9 : 4;
    const minRow = color === PlayerColor.RED ? 5 : 0;

    for (let i = 0; i < 4; i++) {
      const newRow = pos.row + moveOffsets[i][0];
      const newCol = pos.col + moveOffsets[i][1];
      const eyeRow = pos.row + eyeOffsets[i][0];
      const eyeCol = pos.col + eyeOffsets[i][1];

      if (newRow >= minRow && newRow <= maxRow && this.isInBounds({ row: newRow, col: newCol })) {
        // 检查象眼
        if (this.getPiece(board, { row: eyeRow, col: eyeCol }) === null) {
          const target = this.getPiece(board, { row: newRow, col: newCol });
          if (!target || this.getPieceColor(target) !== color) {
            moves.push({ row: newRow, col: newCol });
          }
        }
      }
    }

    return moves;
  }

  private getHorseMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    // 走"日"字，检查蹩马脚
    const horseMoves: [number, number, number, number][] = [
      [-2, -1, -1, 0], [-2, 1, -1, 0],
      [2, -1, 1, 0], [2, 1, 1, 0],
      [-1, -2, 0, -1], [-1, 2, 0, 1],
      [1, -2, 0, -1], [1, 2, 0, 1],
    ];

    for (const [dr, dc, legR, legC] of horseMoves) {
      const newRow = pos.row + dr;
      const newCol = pos.col + dc;
      const legRow = pos.row + legR;
      const legCol = pos.col + legC;

      if (this.isInBounds({ row: newRow, col: newCol })) {
        // 检查蹩马脚
        if (this.getPiece(board, { row: legRow, col: legCol }) === null) {
          const target = this.getPiece(board, { row: newRow, col: newCol });
          if (!target || this.getPieceColor(target) !== color) {
            moves.push({ row: newRow, col: newCol });
          }
        }
      }
    }

    return moves;
  }

  private getRookMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (this.isInBounds({ row: r, col: c })) {
        const target = this.getPiece(board, { row: r, col: c });
        if (target) {
          if (this.getPieceColor(target) !== color) {
            moves.push({ row: r, col: c });
          }
          break;
        }
        moves.push({ row: r, col: c });
        r += dr;
        c += dc;
      }
    }

    return moves;
  }

  private getCannonMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      // 先走(无炮架)
      while (this.isInBounds({ row: r, col: c })) {
        const target = this.getPiece(board, { row: r, col: c });
        if (target) {
          // 找到炮架，跳过它继续找第一个能吃到的棋子
          r += dr;
          c += dc;
          while (this.isInBounds({ row: r, col: c })) {
            const target2 = this.getPiece(board, { row: r, col: c });
            if (target2) {
              if (this.getPieceColor(target2) !== color) {
                moves.push({ row: r, col: c });
              }
              break;
            }
            r += dr;
            c += dc;
          }
          break;
        }
        moves.push({ row: r, col: c });
        r += dr;
        c += dc;
      }
    }

    return moves;
  }

  private getPawnMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const forward = color === PlayerColor.RED ? -1 : 1; // 红方向上是-1, 黑方向上是+1
    const hasCrossed = color === PlayerColor.RED ? pos.row <= 4 : pos.row >= 5;

    // 前进
    const fwdRow = pos.row + forward;
    if (this.isInBounds({ row: fwdRow, col: pos.col })) {
      const target = this.getPiece(board, { row: fwdRow, col: pos.col });
      if (!target || this.getPieceColor(target) !== color) {
        moves.push({ row: fwdRow, col: pos.col });
      }
    }

    // 过河后可以横走
    if (hasCrossed) {
      for (const dc of [-1, 1]) {
        const newCol = pos.col + dc;
        if (this.isInBounds({ row: pos.row, col: newCol })) {
          const target = this.getPiece(board, { row: pos.row, col: newCol });
          if (!target || this.getPieceColor(target) !== color) {
            moves.push({ row: pos.row, col: newCol });
          }
        }
      }
    }

    return moves;
  }

  // ==================== 将军/将死检测 ====================

  private findKing(board: (string | null)[][], color: PlayerColor): Position | null {
    const kingPiece = color === PlayerColor.RED ? 'K' : 'k';
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === kingPiece) return { row: r, col: c };
      }
    }
    return null;
  }

  /** 检查 color 方是否被将军 */
  isInCheck(state: BoardState, color: PlayerColor): boolean {
    const kingPos = this.findKing(state.board, color);
    if (!kingPos) return false;

    const opponent = color === PlayerColor.RED ? PlayerColor.BLUE : PlayerColor.RED;

    // 检查对手的所有棋子是否能攻击到帅/将
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = state.board[r][c];
        if (piece && this.getPieceColor(piece) === opponent) {
          const moves = this.getRawMoves(state.board, { row: r, col: c });
          if (moves.some(m => m.row === kingPos.row && m.col === kingPos.col)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /** 检查将帅是否照面(同列无阻挡) */
  private kingsAreFacing(state: BoardState): boolean {
    const redKing = this.findKing(state.board, PlayerColor.RED);
    const blackKing = this.findKing(state.board, PlayerColor.BLUE);
    if (!redKing || !blackKing) return false;

    if (redKing.col !== blackKing.col) return false;

    // 检查同列之间是否有棋子
    const minRow = Math.min(redKing.row, blackKing.row);
    const maxRow = Math.max(redKing.row, blackKing.row);
    for (let r = minRow + 1; r < maxRow; r++) {
      if (state.board[r][redKing.col] !== null) return false;
    }

    return true;
  }

  /** 检查是否将死(无合法走法) */
  private isCheckmated(state: BoardState, color: PlayerColor): boolean {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = state.board[r][c];
        if (piece && this.getPieceColor(piece) === color) {
          const from = { row: r, col: c };
          const legalMoves = this.getLegalMoves(state, from);
          for (const to of legalMoves) {
            // 直接模拟走法并检查自将/照面，避免 validateMove 重复调用 getLegalMoves
            const simState = this.simulateMove(state, { from, to, piece });
            if (!this.isInCheck(simState, color) && !this.kingsAreFacing(simState)) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  /** 模拟走法(不校验合法性) */
  private simulateMove(state: BoardState, move: Move): BoardState {
    const piece = this.getPiece(state.board, move.from);
    let board = this.setPiece(state.board, move.from, null);
    board = this.setPiece(board, move.to, piece);
    return { ...state, board };
  }

  /** 获取原始走法(不含将军/照面校验) */
  private getRawMoves(board: (string | null)[][], pos: Position): Position[] {
    const piece = this.getPiece(board, pos);
    if (!piece) return [];

    const color = this.getPieceColor(piece);
    const pieceType = piece.toUpperCase();

    switch (pieceType) {
      case 'K': return this.getKingMoves(board, pos, color);
      case 'G': return this.getAdvisorMoves(board, pos, color);
      case 'E': return this.getElephantMoves(board, pos, color);
      case 'H': return this.getHorseMoves(board, pos, color);
      case 'R': return this.getRookMoves(board, pos, color);
      case 'C': return this.getCannonMoves(board, pos, color);
      case 'P': return this.getPawnMoves(board, pos, color);
      default: return [];
    }
  }
}
