import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../services/socket';
import { Move, PlayerColor } from 'shared';

const SIZE = 8;
const CELL_SIZE = 60;
const PADDING = 30;
const CANVAS_SIZE = CELL_SIZE * SIZE + PADDING * 2;
const PIECE_SIZE = 24;

// 棋子 Unicode 映射
const PIECE_UNICODE: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

// 升变棋子选项
const PROMOTION_PIECES = ['Q', 'R', 'B', 'N'] as const;
const PROMOTION_LABELS: Record<string, string> = {
  'Q': '皇后', 'R': '车', 'B': '象', 'N': '马',
};

export default function ChessBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { boardState, currentPlayer, lastMove, gameOver, currentRoom } = useGameStore();
  const user = useAuthStore((s) => s.user);
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    piece: string;
    capturedPiece?: string;
  } | null>(null);

  // 对手走棋后清除选中的棋子
  useEffect(() => {
    setSelectedPos(null);
  }, [boardState?.moveCount]);

  // 获取当前用户执棋颜色
  const myColor = currentRoom?.players.find(p => p.userId === user?.id)?.color ?? null;

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 棋盘格子
    const lightColor = '#F0D9B5';
    const darkColor = '#B58863';

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = PADDING + c * CELL_SIZE;
        const y = PADDING + r * CELL_SIZE;
        ctx.fillStyle = (r + c) % 2 === 0 ? lightColor : darkColor;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    // 坐标标注
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    for (let c = 0; c < SIZE; c++) {
      ctx.fillText(String.fromCharCode(97 + c), PADDING + c * CELL_SIZE + CELL_SIZE / 2, PADDING - 8);
      ctx.fillText(String.fromCharCode(97 + c), PADDING + c * CELL_SIZE + CELL_SIZE / 2, CANVAS_SIZE - PADDING + 18);
    }
    ctx.textAlign = 'right';
    for (let r = 0; r < SIZE; r++) {
      ctx.fillText((8 - r).toString(), PADDING - 8, PADDING + r * CELL_SIZE + CELL_SIZE / 2 + 4);
    }
    ctx.textAlign = 'left';
    for (let r = 0; r < SIZE; r++) {
      ctx.fillText((8 - r).toString(), CANVAS_SIZE - PADDING + 8, PADDING + r * CELL_SIZE + CELL_SIZE / 2 + 4);
    }

    // 最后一步高亮
    if (lastMove) {
      for (const pos of [lastMove.from, lastMove.to]) {
        const [r, c] = pos;
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.fillRect(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // 选中高亮
    if (selectedPos) {
      const [sr, sc] = selectedPos;
      ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
      ctx.fillRect(PADDING + sc * CELL_SIZE, PADDING + sr * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    // 将军高亮：被将军的王闪烁红框
    if (boardState?.inCheck) {
      const checkedColor = boardState.inCheck;
      const kingPiece = checkedColor === 'WHITE' ? 'K' : 'k';
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (boardState.board[r][c] === kingPiece) {
            const kx = PADDING + c * CELL_SIZE + CELL_SIZE / 2;
            const ky = PADDING + r * CELL_SIZE + CELL_SIZE / 2;
            ctx.strokeStyle = '#e00';
            ctx.lineWidth = 3;
            ctx.strokeRect(kx - CELL_SIZE / 2 + 2, ky - CELL_SIZE / 2 + 2, CELL_SIZE - 4, CELL_SIZE - 4);
          }
        }
      }
    }

    // 棋子
    if (!boardState?.board) return;
    ctx.font = `${PIECE_SIZE * 2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = boardState.board[r][c];
        if (!piece) continue;

        const x = PADDING + c * CELL_SIZE + CELL_SIZE / 2;
        const y = PADDING + r * CELL_SIZE + CELL_SIZE / 2;

        // 棋子阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillText(PIECE_UNICODE[piece] || piece, x + 1, y + 1);

        // 棋子
        const isWhite = piece === piece.toUpperCase();
        ctx.fillStyle = isWhite ? '#fff' : '#000';
        ctx.strokeStyle = isWhite ? '#000' : '#fff';
        ctx.lineWidth = 1;
        ctx.fillText(PIECE_UNICODE[piece] || piece, x, y);
      }
    }
  }, [boardState, lastMove, selectedPos]);

  useEffect(() => {
    drawBoard();
  }, [drawBoard]);

  const handlePromotionSelect = (promoPiece: string) => {
    if (!pendingPromotion) return;

    const promotion = pendingPromotion.piece === 'P' ? promoPiece.toUpperCase() : promoPiece.toLowerCase();

    const move: Move = {
      from: { row: pendingPromotion.fromRow, col: pendingPromotion.fromCol },
      to: { row: pendingPromotion.toRow, col: pendingPromotion.toCol },
      piece: pendingPromotion.piece,
      promotion,
      captured: pendingPromotion.capturedPiece || undefined,
    };

    const socket = getSocket();
    socket?.emit('game:move', {
      roomId: (window as any).__currentRoomId,
      move,
    });

    setPendingPromotion(null);
    setSelectedPos(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver || pendingPromotion) return;
    // 检查回合：只有轮到己方时才能操作
    if (!currentPlayer || !myColor || currentPlayer !== myColor) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const colFloat = (x - PADDING) / CELL_SIZE;
    const rowFloat = (y - PADDING) / CELL_SIZE;
    const col = Math.floor(colFloat);
    const row = Math.floor(rowFloat);

    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
    // 近距检查：点击必须在格子范围内
    if (colFloat < -0.1 || rowFloat < -0.1 || colFloat > SIZE || rowFloat > SIZE) return;

    if (!selectedPos) {
      // 选择棋子
      const piece = boardState?.board[row][col];
      if (piece) {
        const isWhite = piece === piece.toUpperCase();
        const expectedColor = currentPlayer === PlayerColor.WHITE ? 'WHITE' : 'BLACK';
        const pieceColor = isWhite ? 'WHITE' : 'BLACK';
        if (pieceColor === expectedColor) {
          setSelectedPos([row, col]);
        }
      }
    } else {
      // 走棋
      const [fromRow, fromCol] = selectedPos;
      const piece = boardState?.board[fromRow][fromCol];

      if (row === fromRow && col === fromCol) {
        setSelectedPos(null);
        return;
      }

      // 点击己方棋子切换选择
      const targetPiece = boardState?.board[row][col];
      if (targetPiece) {
        const isWhite = targetPiece === targetPiece.toUpperCase();
        const expectedColor = currentPlayer === PlayerColor.WHITE ? 'WHITE' : 'BLACK';
        const pieceColor = isWhite ? 'WHITE' : 'BLACK';
        if (pieceColor === expectedColor) {
          setSelectedPos([row, col]);
          return;
        }
      }

      // 兵升变：到达底线 — 弹窗选择升变棋子
      if (piece?.toUpperCase() === 'P') {
        const promoRow = piece === 'P' ? 0 : 7;
        if (row === promoRow) {
          setPendingPromotion({
            fromRow,
            fromCol,
            toRow: row,
            toCol: col,
            piece: piece!,
            capturedPiece: targetPiece || undefined,
          });
          return;
        }
      }

      const move: Move = {
        from: { row: fromRow, col: fromCol },
        to: { row, col },
        piece: piece || '',
        captured: targetPiece || undefined,
      };

      const socket = getSocket();
      socket?.emit('game:move', {
        roomId: (window as any).__currentRoomId,
        move,
      });

      setSelectedPos(null);
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onClick={handleClick}
        className="game-board rounded-xl shadow-lg cursor-pointer"
        style={{ width: Math.min(CANVAS_SIZE, window.innerWidth - 40) }}
      />

      {/* 升变选择弹窗 */}
      {pendingPromotion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-center text-gray-800">选择升变棋子</h3>
            <div className="flex gap-4 justify-center">
              {PROMOTION_PIECES.map(piece => {
                const isWhite = pendingPromotion.piece === 'P';
                const unicodeKey = isWhite ? piece : piece.toLowerCase();
                return (
                  <button
                    key={piece}
                    onClick={() => handlePromotionSelect(piece)}
                    className="w-16 h-16 text-3xl rounded-xl bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 transition-all hover:scale-110 flex flex-col items-center justify-center"
                    title={PROMOTION_LABELS[piece]}
                  >
                    <span>{PIECE_UNICODE[unicodeKey]}</span>
                    <span className="text-xs text-gray-500">{PROMOTION_LABELS[piece]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
