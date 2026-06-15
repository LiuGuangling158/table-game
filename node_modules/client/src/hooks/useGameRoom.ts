import { useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { useGameStore } from '../stores/gameStore';
import { BoardState, Move, PlayerColor, GameType, GameRoomInfo } from 'shared';

export function useGameRoom(roomId: string) {
  const {
    setBoardState,
    setCurrentPlayer,
    setLastMove,
    setGameOver,
    setCurrentRoom,
    setLegalMoves,
    resetGame,
  } = useGameStore();

  // 使用 ref 跟踪已注册事件，避免重复注册
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    if (!socket) {
      console.warn('[useGameRoom] Socket 未连接，延迟注册事件');
      return;
    }

    // 避免 React StrictMode 重复注册
    if (registeredRef.current) return;
    registeredRef.current = true;

    // 请求当前游戏状态
    socket.emit('game:get_state', { roomId });

    // 游戏状态同步 (来自 init 或 get_state)
    const onSync = (data: { fullState: BoardState; currentPlayer: PlayerColor; legalMoves?: Array<{ from: [number, number]; to: [number, number] }> }) => {
      setBoardState(data.fullState);
      setCurrentPlayer(data.currentPlayer);
      if (data.legalMoves) {
        setLegalMoves(data.legalMoves);
      }
    };

    // 走棋结果
    const onMoveResult = (data: { valid: boolean; move: Move; newState: BoardState; message?: string; captured?: string; isCheck?: boolean }) => {
      if (data.valid) {
        setBoardState(data.newState);
        setCurrentPlayer(data.newState.currentPlayer);
        setLastMove({
          from: [data.move.from.row, data.move.from.col],
          to: [data.move.to.row, data.move.to.col],
        });
      } else if (data.message) {
        console.warn('[Game] 无效走法:', data.message);
      }
    };

    // 轮到谁 (附带合法走法)
    const onTurn = (data: { currentPlayer: PlayerColor; legalMoves?: Array<{ from: [number, number]; to: [number, number] }> }) => {
      setCurrentPlayer(data.currentPlayer);
      if (data.legalMoves) {
        setLegalMoves(data.legalMoves);
      }
    };

    // 游戏结束
    const onGameOver = (data: { winner: PlayerColor | null; reason: string }) => {
      setGameOver(data);
    };

    // 加入房间确认
    const onJoined = (data: { room: GameRoomInfo }) => {
      setCurrentRoom(data.room);
    };

    // 断线重连恢复
    const handleReconnect = () => {
      console.log('[useGameRoom] Socket 重连，恢复游戏状态, room:', roomId);
      socket.emit('room:join', { roomId });
      setTimeout(() => {
        socket.emit('game:get_state', { roomId });
      }, 300);
    };

    socket.on('game:sync', onSync);
    socket.on('game:move_result', onMoveResult);
    socket.on('game:turn', onTurn);
    socket.on('game:over', onGameOver);
    socket.on('room:joined', onJoined);
    socket.on('connect', handleReconnect);

    return () => {
      registeredRef.current = false;
      socket.off('game:sync', onSync);
      socket.off('game:move_result', onMoveResult);
      socket.off('game:turn', onTurn);
      socket.off('game:over', onGameOver);
      socket.off('room:joined', onJoined);
      socket.off('connect', handleReconnect);
    };
  }, [roomId]);

  const sendMove = useCallback((move: Move) => {
    getSocket()?.emit('game:move', { roomId, move });
  }, [roomId]);

  const resign = useCallback(() => {
    getSocket()?.emit('game:resign', { roomId });
  }, [roomId]);

  const requestDraw = useCallback(() => {
    getSocket()?.emit('game:draw_request', { roomId });
  }, [roomId]);

  const respondDraw = useCallback((accept: boolean) => {
    getSocket()?.emit('game:draw_response', { roomId, accept });
  }, [roomId]);

  const initGame = useCallback((gameType: GameType) => {
    getSocket()?.emit('game:init', { roomId, gameType });
  }, [roomId]);

  const leaveRoom = useCallback(() => {
    getSocket()?.emit('room:leave', { roomId });
    resetGame();
  }, [roomId, resetGame]);

  return {
    sendMove,
    resign,
    requestDraw,
    respondDraw,
    initGame,
    leaveRoom,
  };
}
