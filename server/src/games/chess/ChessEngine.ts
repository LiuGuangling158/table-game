import { GameEngine } from '../base/GameEngine';
import { BoardState, Move, MoveResult, GameOverResult, Position, PlayerColor, GameType, EndReason } from 'shared';

/**
 * 国际象棋引擎
 *
 * 棋盘: 8×8
 * 白方在下方(row 6-7), 黑方在上方(row 0-1)
 *
 * 棋子表示:
 *   白方(大写): K=王, Q=后, R=车, B=象, N=马, P=兵
 *   黑方(小写): k=王, q=后, r=车, b=象, n=马, p=兵
 *
 * 状态标志:
 *   castlingRights: 王车易位权限
 *   enPassantTarget: 吃过路兵目标位置
 */
export class ChessEngine extends GameEngine {
  readonly gameType = GameType.CHESS;
  readonly boardRows = 8;
  readonly boardCols = 8;

  getInitialState(): BoardState {
    const board: (string | null)[][] = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    ];

    return {
      board,
      currentPlayer: PlayerColor.WHITE,
      moveCount: 0,
      castlingRights: {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true,
      },
      enPassantTarget: null,
    };
  }

  getLegalMoves(state: BoardState, position: Position): Position[] {
    const piece = this.getPiece(state.board, position);
    if (!piece) return [];

    const color = this.getPieceColor(piece);
    const rawMoves = this.getRawMoves(state, position, color);
    const pieceType = piece.toUpperCase();

    let legalMoves: Position[] = [];

    for (const to of rawMoves) {
      const move: Move = { from: position, to, piece };
      const simState = this.simulateMove(state, move);

      // 额外: 王车易位要走两格
      if (pieceType === 'K' && Math.abs(to.col - position.col) === 2) {
        if (this.isCastlingValid(state, position, to, color)) {
          legalMoves.push(to);
        }
        continue;
      }

      // 检查走后是否被将军
      if (!this.isInCheck(simState, color)) {
        legalMoves.push(to);
      }
    }

    return legalMoves;
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

    const targetPiece = this.getPiece(state.board, to);
    if (targetPiece && this.getPieceColor(targetPiece) === pieceColor) {
      return { valid: false, message: '不能吃己方棋子' };
    }

    const legalMoves = this.getLegalMoves(state, from);
    const isLegalMove = legalMoves.some(m => m.row === to.row && m.col === to.col);

    if (!isLegalMove) {
      return { valid: false, message: '不符合走法规则' };
    }

    const captured = targetPiece || undefined;
    return { valid: true, captured };
  }

  applyMove(state: BoardState, move: Move): BoardState {
    const piece = this.getPiece(state.board, move.from);
    const pieceColor = this.getPieceColor(piece!);
    const pieceType = piece!.toUpperCase();

    let newBoard = this.setPiece(state.board, move.from, null);
    newBoard = this.setPiece(newBoard, move.to, piece);

    // 更新王车易位权限
    let castlingRights = {
      whiteKingSide: state.castlingRights?.whiteKingSide ?? true,
      whiteQueenSide: state.castlingRights?.whiteQueenSide ?? true,
      blackKingSide: state.castlingRights?.blackKingSide ?? true,
      blackQueenSide: state.castlingRights?.blackQueenSide ?? true,
    };
    if (pieceType === 'K') {
      if (pieceColor === PlayerColor.WHITE) {
        castlingRights.whiteKingSide = false;
        castlingRights.whiteQueenSide = false;
      } else {
        castlingRights.blackKingSide = false;
        castlingRights.blackQueenSide = false;
      }
    }
    if (pieceType === 'R') {
      if (move.from.row === 7 && move.from.col === 0) castlingRights.whiteQueenSide = false;
      if (move.from.row === 7 && move.from.col === 7) castlingRights.whiteKingSide = false;
      if (move.from.row === 0 && move.from.col === 0) castlingRights.blackQueenSide = false;
      if (move.from.row === 0 && move.from.col === 7) castlingRights.blackKingSide = false;
    }

    // 王车易位 — 移动车
    if (pieceType === 'K' && Math.abs(move.to.col - move.from.col) === 2) {
      const rookFromCol = move.to.col > move.from.col ? 7 : 0;
      const rookToCol = move.to.col > move.from.col ? move.to.col - 1 : move.to.col + 1;
      const rookPiece = pieceColor === PlayerColor.WHITE ? 'R' : 'r';
      newBoard = this.setPiece(newBoard, { row: move.from.row, col: rookFromCol }, null);
      newBoard = this.setPiece(newBoard, { row: move.from.row, col: rookToCol }, rookPiece);
    }

    // 吃过路兵
    let enPassantTarget: Position | null = null;
    if (pieceType === 'P' && Math.abs(move.to.row - move.from.row) === 2) {
      // 设置吃过路兵目标
      const epRow = pieceColor === PlayerColor.WHITE ? move.from.row - 1 : move.from.row + 1;
      enPassantTarget = { row: epRow, col: move.from.col };
    }

    if (pieceType === 'P' && state.enPassantTarget &&
        move.to.row === state.enPassantTarget.row && move.to.col === state.enPassantTarget.col) {
      // 执行吃过路兵 — 移除被吃的兵
      const capturedPawnRow = pieceColor === PlayerColor.WHITE ? move.to.row + 1 : move.to.row - 1;
      newBoard = this.setPiece(newBoard, { row: capturedPawnRow, col: move.to.col }, null);
    }

    // 兵升变
    if (pieceType === 'P') {
      const promotionRow = pieceColor === PlayerColor.WHITE ? 0 : 7;
      if (move.to.row === promotionRow) {
        const promotionPiece = move.promotion || (pieceColor === PlayerColor.WHITE ? 'Q' : 'q');
        newBoard = this.setPiece(newBoard, move.to, promotionPiece);
      }
    }

    const nextColor = this.getNextPlayer(state.currentPlayer);
    const newState: BoardState = {
      ...state,
      board: newBoard,
      currentPlayer: nextColor,
      moveCount: state.moveCount + 1,
      castlingRights,
      enPassantTarget,
    };

    // 检查将军状态
    if (this.isInCheck(newState, nextColor)) {
      newState.inCheck = nextColor;
    } else {
      newState.inCheck = null;
    }

    return newState;
  }

  checkGameOver(state: BoardState): GameOverResult | null {
    const currentPlayer = state.currentPlayer;

    // 检查是否有合法走法
    const hasLegalMoves = this.hasAnyLegalMove(state, currentPlayer);

    if (!hasLegalMoves) {
      if (this.isInCheck(state, currentPlayer)) {
        // 被将死
        const winner = currentPlayer === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
        return { winner, reason: EndReason.CHECKMATE, finalState: state };
      } else {
        // 逼和(无子可动)
        return { winner: null, reason: EndReason.DRAW, finalState: state };
      }
    }

    return null;
  }

  // ==================== 各棋子原始走法(不含将军校验) ====================

  private getRawMoves(state: BoardState, pos: Position, color: PlayerColor): Position[] {
    const piece = this.getPiece(state.board, pos);
    if (!piece) return [];

    switch (piece.toUpperCase()) {
      case 'K': return this.getKingRawMoves(state.board, pos, color, state.castlingRights!);
      case 'Q': return this.getSlidingMoves(state.board, pos, color, true, true);
      case 'R': return this.getSlidingMoves(state.board, pos, color, true, false);
      case 'B': return this.getSlidingMoves(state.board, pos, color, false, true);
      case 'N': return this.getKnightMoves(state.board, pos, color);
      case 'P': return this.getPawnMoves(state, pos, color);
      default: return [];
    }
  }

  private getKingRawMoves(board: (string | null)[][], pos: Position, color: PlayerColor, castlingRights: NonNullable<BoardState['castlingRights']>): Position[] {
    const moves: Position[] = [];
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    for (const [dr, dc] of directions) {
      const newRow = pos.row + dr;
      const newCol = pos.col + dc;
      if (this.isInBounds({ row: newRow, col: newCol })) {
        const target = this.getPiece(board, { row: newRow, col: newCol });
        if (!target || this.getPieceColor(target) !== color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }

    // 王车易位
    const row = color === PlayerColor.WHITE ? 7 : 0;
    if (pos.row === row && pos.col === 4) {
      // 王翼易位
      if (color === PlayerColor.WHITE && castlingRights.whiteKingSide) {
        if (board[7][5] === null && board[7][6] === null && board[7][7] === 'R') {
          moves.push({ row, col: 6 });
        }
      }
      if (color === PlayerColor.BLACK && castlingRights.blackKingSide) {
        if (board[0][5] === null && board[0][6] === null && board[0][7] === 'r') {
          moves.push({ row, col: 6 });
        }
      }
      // 后翼易位
      if (color === PlayerColor.WHITE && castlingRights.whiteQueenSide) {
        if (board[7][1] === null && board[7][2] === null && board[7][3] === null && board[7][0] === 'R') {
          moves.push({ row, col: 2 });
        }
      }
      if (color === PlayerColor.BLACK && castlingRights.blackQueenSide) {
        if (board[0][1] === null && board[0][2] === null && board[0][3] === null && board[0][0] === 'r') {
          moves.push({ row, col: 2 });
        }
      }
    }

    return moves;
  }

  private getSlidingMoves(board: (string | null)[][], pos: Position, color: PlayerColor, straight: boolean, diagonal: boolean): Position[] {
    const moves: Position[] = [];
    const directions: [number, number][] = [];

    if (straight) directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    if (diagonal) directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);

    for (const [dr, dc] of directions) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (this.isInBounds({ row: r, col: c })) {
        const target = this.getPiece(board, { row: r, col: c });
        if (target) {
          if (this.getPieceColor(target) !== color) moves.push({ row: r, col: c });
          break;
        }
        moves.push({ row: r, col: c });
        r += dr;
        c += dc;
      }
    }

    return moves;
  }

  private getKnightMoves(board: (string | null)[][], pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

    for (const [dr, dc] of offsets) {
      const newRow = pos.row + dr;
      const newCol = pos.col + dc;
      if (this.isInBounds({ row: newRow, col: newCol })) {
        const target = this.getPiece(board, { row: newRow, col: newCol });
        if (!target || this.getPieceColor(target) !== color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }

    return moves;
  }

  private getPawnMoves(state: BoardState, pos: Position, color: PlayerColor): Position[] {
    const moves: Position[] = [];
    const forward = color === PlayerColor.WHITE ? -1 : 1;
    const startRow = color === PlayerColor.WHITE ? 6 : 1;

    // 前进一格
    const oneForward = pos.row + forward;
    if (this.isInBounds({ row: oneForward, col: pos.col }) && !state.board[oneForward][pos.col]) {
      moves.push({ row: oneForward, col: pos.col });

      // 从起始位置可前进两格
      if (pos.row === startRow && !state.board[pos.row + 2 * forward][pos.col]) {
        moves.push({ row: pos.row + 2 * forward, col: pos.col });
      }
    }

    // 斜吃
    for (const dc of [-1, 1]) {
      const newCol = pos.col + dc;
      const newRow = oneForward;
      if (this.isInBounds({ row: newRow, col: newCol })) {
        const target = state.board[newRow][newCol];
        if (target && this.getPieceColor(target) !== color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }

    // 吃过路兵
    if (state.enPassantTarget && pos.row === (color === PlayerColor.WHITE ? 3 : 4)) {
      if (Math.abs(pos.col - state.enPassantTarget.col) === 1 &&
          oneForward === state.enPassantTarget.row) {
        moves.push({ row: state.enPassantTarget.row, col: state.enPassantTarget.col });
      }
    }

    return moves;
  }

  // ==================== 将军/将死检测 ====================

  private findKing(board: (string | null)[][], color: PlayerColor): Position | null {
    const kingPiece = color === PlayerColor.WHITE ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === kingPiece) return { row: r, col: c };
      }
    }
    return null;
  }

  private isInCheck(state: BoardState, color: PlayerColor): boolean {
    const kingPos = this.findKing(state.board, color);
    if (!kingPos) return false;

    const opponent = color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c];
        if (piece && this.getPieceColor(piece) === opponent) {
          const rawMoves = this.getRawMoves(state, { row: r, col: c }, opponent);
          if (rawMoves.some(m => m.row === kingPos.row && m.col === kingPos.col)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private hasAnyLegalMove(state: BoardState, color: PlayerColor): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c];
        if (piece && this.getPieceColor(piece) === color) {
          const moves = this.getLegalMoves(state, { row: r, col: c });
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  private isCastlingValid(state: BoardState, kingFrom: Position, kingTo: Position, color: PlayerColor): boolean {
    // 检查王当前是否被将军
    if (this.isInCheck(state, color)) return false;

    // 检查王经过的格子是否被攻击
    const direction = kingTo.col > kingFrom.col ? 1 : -1;
    for (let col = kingFrom.col; col !== kingTo.col + direction; col += direction) {
      const simState = this.simulateMove(state, {
        from: kingFrom,
        to: { row: kingFrom.row, col },
        piece: color === PlayerColor.WHITE ? 'K' : 'k',
      });
      if (this.isInCheck(simState, color)) return false;
    }

    return true;
  }

  private simulateMove(state: BoardState, move: Move): BoardState {
    const piece = this.getPiece(state.board, move.from);
    let board = this.setPiece(state.board, move.from, null);
    board = this.setPiece(board, move.to, piece);
    return { ...state, board };
  }
}
