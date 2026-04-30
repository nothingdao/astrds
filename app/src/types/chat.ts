// src/types/chat.ts

export interface ChatMessage {
  id: string;
  walletAddress: string;
  message: string;
  timestamp: string;
}

export interface ChatState {
  overlayVisible: boolean;
  chatMode: "full" | "overlay" | null;
  isPaused: boolean;
  error: Error | null;
  isLoading: boolean;
}

export interface ChatActions {
  toggleOverlay: () => void;
  toggleFullChat: () => void;
  closeChat: () => void;
  setMode: (mode: ChatState["chatMode"]) => void;
  togglePause: () => void;
  setError: (error: Error | null) => void;
  sendMessage: (walletAddress: string, message: string) => Promise<boolean>;
  initializeChat: () => Promise<void>;
}

export type ChatStore = ChatState & ChatActions;

export interface ChatProps {
  isOverlay?: boolean;
  onClose?: () => void;
  onPlayClick?: () => void;
}

export interface ChatMessageProps {
  message: ChatMessage;
  isOwnMessage: boolean;
}

export interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  loading?: boolean;
}
