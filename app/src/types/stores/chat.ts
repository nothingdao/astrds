// src/types/stores/chat.ts
export interface ChatMessage {
  id: string
  walletAddress: string
  message: string
  timestamp: string
}

export interface ChatStoreState {
  messages: ChatMessage[]
  overlayVisible: boolean
  chatMode: 'full' | 'overlay' | null
  isPaused: boolean
}

export interface ChatStoreActions {
  addMessage: (message: ChatMessage) => void
  toggleOverlay: () => void
  toggleFullChat: () => void
  closeChat: () => void
  setMode: (mode: ChatStoreState['chatMode']) => void
  togglePause: () => void
  clearMessages: () => void
  setMessages: (messages: ChatMessage[]) => void
}

export type ChatStore = ChatStoreState & ChatStoreActions
