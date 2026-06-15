import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getSocket } from '../../services/socket';
import { Move, PlayerColor } from 'shared';

const ROWS = 10;
const COLS = 9;
const CELL_SIZE = 56;
const PADDING = 28;
const CANVAS_W = CELL_SIZE * (COLS - 1) + PADDING * 2;
const CANVAS_H = CELL_SIZE * (ROWS - 1) + PADDING * 2;
const PIECE_RADIUS = 22;

// 棋子中文映射
const PIECE_NAMES: Record<string, string> = {
  'K': '帅', 'G': '仕', 'E': '相', 'H': '馬', 'R': '車', 'C': '炮', 'P': '兵',
  'k': '将', 'g': '士', 'e': '象', 'h': '马', 'r': '车', 'c': '砲', 'p': '卒',
};

export default function XiangqiBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { boardState, currentPlayer, lastMove, gameOver, legalMoves } = useGameStore();
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);

  // 根据选中的棋子过滤合法走法目标
  const selectedLegalToPositions = useMemo(() => {
    if (!selectedPos) return [];
    return legalMoves
      .filter(m => m.from[0] === selectedPos[0] && m.from[1] === selectedPos[1])
      .map(m => m.to);
  }, [selectedPos, legalMoves]);

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // 背景
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 棋盘格子
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    for (let r = 0; r < ROWS; r++) {
      const y = PADDING + r * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(CANVAS_W - PADDING, y);
      ctx.stroke();
    }

    for (let c = 0; c < COLS; c++) {
      const x = PADDING + c * CELL_SIZE;
      // 河界断开
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, PADDING + 4 * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, PADDING + 5 * CELL_SIZE);
      ctx.lineTo(x, CANVAS_H - PADDING);
      ctx.stroke();
    }

    // 左边界
    ctx.strokeRect(PADDING, PADDING, CANVAS_W - PADDING * 2, CANVAS_H - PADDING * 2);

    // 九宫格斜线
    ctx.lineWidth = 0.5;
    const drawPalace = (topRow: number) => {
      ctx.beginPath();
      ctx.moveTo(PADDING + 3 * CELL_SIZE, PADDING + topRow * CELL_SIZE);
      ctx.lineTo(PADDING + 5 * CELL_SIZE, PADDING + (topRow + 2) * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING + 5 * CELL_SIZE, PADDING + topRow * CELL_SIZE);
      ctx.lineTo(PADDING + 3 * CELL_SIZE, PADDING + (topRow + 2) * CELL_SIZE);
      ctx.stroke();
    };
    drawPalace(0);
    drawPalace(7);

    // 楚河汉界
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('楚  河', PADDING + 2 * CELL_SIZE, PADDING + 4.6 * CELL_SIZE);
    ctx.fillText('汉  界', PADDING + 6 * CELL_SIZE, PADDING + 4.6 * CELL_SIZE);

    // 合法走法提示 (绿色圆点)
    selectedLegalToPositions.forEach(([r, c]) => {
      const x = PADDING + c * CELL_SIZE;
      const y = PADDING + r * CELL_SIZE;
      ctx.fillStyle = 'rgba(0, 150, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 最后一步标记
    if (lastMove && boardState) {
      for (const pos of [lastMove.from, lastMove.to]) {
        const [r, c] = pos;
        const x = PADDING + c * CELL_SIZE;
        const y = PADDING + r * CELL_SIZE;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
        ctx.fillRect(x - PIECE_RADIUS, y - PIECE_RADIUS, PIECE_RADIUS * 2, PIECE_RADIUS * 2);
      }
    }

    // 棋子
    if (!boardState?.board) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = boardState.board[r][c];
        if (!piece) continue;

        const x = PADDING + c * CELL_SIZE;
        const y = PADDING + r * CELL_SIZE;

        const isRed = piece === piece.toUpperCase();
        const isSelected = selectedPos && selectedPos[0] === r && selectedPos[1] === c;

        // 棋子背景
        ctx.fillStyle = '#F5DEB3';
        ctx.strokeStyle = isSelected ? '#00f' : isRed ? '#c00' : '#000';
        ctx.lineWidth = isSelected ? 3 : 2;

        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 内圈
        ctx.strokeStyle = isRed ? '#c00' : '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS - 4, 0, Math.PI * 2);
        ctx.stroke();

        // 文字
        ctx.fillStyle = isRed ? '#c00' : '#000';
        ctx.font = 'bold 22px "KaiTi", "STKaiti", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(PIECE_NAMES[piece] || piece, x, y);
      }
    }
  }, [boardState, lastMove, selectedPos, selectedLegalToPositions]);

  useEffect(() => {
    drawBoard();
  }, [drawBoard]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.round((x - PADDING) / CELL_SIZE);
    const row = Math.round((y - PADDING) / CELL_SIZE);

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    if (!selectedPos) {
      // 选择棋子
      const piece = boardState?.board[row][col];
      if (piece) {
        const isRed = piece === piece.toUpperCase();
        const expectedColor = currentPlayer === PlayerColor.RED ? 'RED' : 'BLUE';
        const pieceColor = isRed ? 'RED' : 'BLUE';
        if (pieceColor === expectedColor) {
          setSelectedPos([row, col]);
        }
      }
    } else {
      // 走棋
      const [fromRow, fromCol] = selectedPos;
      const piece = boardState?.board[fromRow][fromCol];

      if (row === fromRow && col === fromCol) {
        // 取消选择
        setSelectedPos(null);
        return;
      }

      // 点击己方棋子切换选择
      const targetPiece = boardState?.board[row][col];
      if (targetPiece) {
        const isRed = targetPiece === targetPiece.toUpperCase();
        const expectedColor = currentPlayer === PlayerColor.RED ? 'RED' : 'BLUE';
        const pieceColor = isRed ? 'RED' : 'BLUE';
        if (pieceColor === expectedColor) {
          setSelectedPos([row, col]);
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
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onClick={handleClick}
      className="game-board rounded-xl shadow-lg cursor-pointer"
      style={{ width: Math.min(CANVAS_W, window.innerWidth - 40) }}
    />
  );
}
