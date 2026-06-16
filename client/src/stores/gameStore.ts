import { create } from 'zustand';
import { BoardState, Move, PlayerColor, GameType, GameRoomInfo } from 'shared';

interface GameStore {
  // 当前游戏
  currentRoom: GameRoomInfo | null;
  boardState: BoardState | null;
  currentPlayer: PlayerColor | null;
  selectedPiece: [number, number] | null;
  legalMoves: { from: [number, number]; to: [number, number] }[];
  lastMove: { from: [number, number]; to: [number, number] } | null;
  gameOver: { winner: PlayerColor | null; reason: string } | null;

  // 大厅
  roomList: GameRoomInfo[];

  // 抽王八配置
  wangbaDrawMode: string;

  // Actions
  setCurrentRoom: (room: GameRoomInfo | null) => void;
  setBoardState: (state: BoardState) => void;
  setCurrentPlayer: (player: PlayerColor) => void;
  selectPiece: (pos: [number, number] | null) => void;
  setLegalMoves: (moves: { from: [number, number]; to: [number, number] }[]) => void;
  setLastMove: (move: { from: [number, number]; to: [number, number] } | null) => void;
  setGameOver: (result: { winner: PlayerColor | null; reason: string } | null) => void;
  setRoomList: (rooms: GameRoomInfo[]) => void;
  setWangbaDrawMode: (mode: string) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  currentRoom: null,
  boardState: null,
  currentPlayer: null,
  selectedPiece: null,
  legalMoves: [],
  lastMove: null,
  gameOver: null,
  roomList: [],
  wangbaDrawMode: 'neighbor',

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setBoardState: (state) => set({ boardState: state }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  selectPiece: (pos) => set({ selectedPiece: pos }),
  setLegalMoves: (moves) => set({ legalMoves: moves }),
  setLastMove: (move) => set({ lastMove: move }),
  setGameOver: (result) => set({ gameOver: result }),
  setRoomList: (rooms) => set({ roomList: rooms }),
  setWangbaDrawMode: (mode) => set({ wangbaDrawMode: mode }),
  resetGame: () => set({
    boardState: null,
    currentPlayer: null,
    selectedPiece: null,
    legalMoves: [],
    lastMove: null,
    gameOver: null,
    currentRoom: null,
    roomList: [],
    wangbaDrawMode: 'neighbor',
  }),
}));
