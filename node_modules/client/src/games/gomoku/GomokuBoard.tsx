import { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getSocket } from '../../services/socket';
import { Move, PlayerColor } from 'shared';

const BOARD_SIZE = 15;
const CELL_SIZE = 36;
const PADDING = 20;
const CANVAS_SIZE = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;
const STONE_RADIUS = CELL_SIZE * 0.42;

export default function GomokuBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { boardState, currentPlayer, lastMove, gameOver } = useGameStore();

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 背景
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 网格线
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pos = PADDING + i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(PADDING, pos);
      ctx.lineTo(CANVAS_SIZE - PADDING, pos);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos, PADDING);
      ctx.lineTo(pos, CANVAS_SIZE - PADDING);
      ctx.stroke();
    }

    // 星位 (天元和四星)
    const starPoints = [
      [3, 3], [3, 7], [3, 11],
      [7, 3], [7, 7], [7, 11],
      [11, 3], [11, 7], [11, 11],
    ];
    ctx.fillStyle = '#333';
    starPoints.forEach(([r, c]) => {
      ctx.beginPath();
      ctx.arc(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 棋子
    if (!boardState?.board) return;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = boardState.board[r][c];
        if (!piece) continue;

        const x = PADDING + c * CELL_SIZE;
        const y = PADDING + r * CELL_SIZE;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, STONE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // 棋子
        const gradient = ctx.createRadialGradient(x - 3, y - 3, STONE_RADIUS * 0.1, x, y, STONE_RADIUS);
        if (piece === 'B') {
          gradient.addColorStop(0, '#555');
          gradient.addColorStop(1, '#111');
        } else {
          gradient.addColorStop(0, '#fff');
          gradient.addColorStop(1, '#ccc');
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // 最后一步标记
        if (lastMove && lastMove.to[0] === r && lastMove.to[1] === c) {
          ctx.fillStyle = piece === 'B' ? '#fff' : '#f00';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [boardState, lastMove]);

  useEffect(() => {
    drawBoard();
  }, [drawBoard]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.round((x - PADDING) / CELL_SIZE);
    const row = Math.round((y - PADDING) / CELL_SIZE);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
    if (boardState?.board[row][col]) return;

    const pieceNotation = currentPlayer === PlayerColor.BLACK ? 'B' : 'W';

    const move: Move = {
      from: { row, col },
      to: { row, col },
      piece: pieceNotation,
    };

    const socket = getSocket();
    const roomId = (window as any).__currentRoomId;
    socket?.emit('game:move', { roomId, move });
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      onClick={handleClick}
      className="game-board rounded-xl shadow-lg cursor-pointer"
      style={{ width: Math.min(CANVAS_SIZE, window.innerWidth - 40) }}
    />
  );
}
