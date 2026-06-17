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
    if (!socket) return;

    // 避免 React StrictMode 重复注册
    if (registeredRef.current) return;

    // 游戏状态同步 (来自 init 或 get_state)
    const onSync = (data: { fullState: BoardState; currentPlayer: PlayerColor; legalMoves?: Array<{ from: [number, number]; to: [number, number] }> }) => {
      setBoardState(data.fullState);
      setCurrentPlayer(data.currentPlayer);
      if (data.legalMoves) {
        setLegalMoves(data.legalMoves);
      }
      // Bug 30: 新游戏同步时清除旧游戏的结束状态
      setGameOver(null);
      setLastMove(null);
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

    // 注册所有事件处理器
    const registerEvents = () => {
      socket.on('game:sync', onSync);
      socket.on('game:move_result', onMoveResult);
      socket.on('game:turn', onTurn);
      socket.on('game:over', onGameOver);
      socket.on('room:joined', onJoined);
    };

    // 断线重连 / 延迟注册
    const handleConnect = () => {
      registerEvents();
      socket.emit('room:join', { roomId });
      // 加入房间后请求游戏状态
      setTimeout(() => {
        socket.emit('game:get_state', { roomId });
      }, 300);
    };

    // Socket 已连接：直接注册事件 + 确保 socket 在房间内（修复 StrictMode 双重挂载导致 room:leave 后未重新加入的问题）
    if (socket.connected) {
      registeredRef.current = true;
      registerEvents();
      socket.emit('room:join', { roomId });
    } else {
      // Socket 尚未连接：等待 connect 事件触发后再注册
      registeredRef.current = true;
      socket.once('connect', handleConnect);
    }

    // 重连时重新注册 (仅用于重连场景，首次连接由上面分支处理)
    const handleReconnect = () => { handleConnect(); };
    socket.on('connect', handleReconnect);

    return () => {
      registeredRef.current = false;
      socket.off('game:sync', onSync);
      socket.off('game:move_result', onMoveResult);
      socket.off('game:turn', onTurn);
      socket.off('game:over', onGameOver);
      socket.off('room:joined', onJoined);
      socket.off('connect', handleReconnect);
      socket.off('connect', handleConnect); // 清理 once 监听器
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

  const initGame = useCallback((gameType: GameType, drawMode?: string) => {
    if (gameType === 'WANGBA') {
      getSocket()?.emit('game:wangba_init', { roomId, drawMode });
    } else {
      getSocket()?.emit('game:init', { roomId, gameType });
    }
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
