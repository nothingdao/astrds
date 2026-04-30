import { Score } from "../core";

export interface GameSessionState {
  status: "active" | "ending" | "ended" | null;
  endTime?: string;
}

export interface GameError {
  code: string;
  message: string;
  details?: unknown;
}

export interface GameStats {
  score: number;
  rank: number;
  isHighScore: boolean;
  totalPlayers: number;
}

export interface GameStoreState {
  isProcessing: boolean;
  score: number;
  topScore: number;
  lastGameStats: GameStats | null;
  error: GameError | null;
  currentSessionId: string | null;
  walletAddress: string | null;
  sessionState: GameSessionState;
}

export interface GameStore extends GameStoreState {
  updateScore: (score: number) => void;
  addToScore: (points: number) => void;
  submitFinalScore: (walletAddress: string) => Promise<Score[] | null>;
  resetGame: () => void;
  clearError: () => void;
  startGameSession: (walletAddress: string) => Promise<string>;
  endGameSession: () => Promise<void>;
}
