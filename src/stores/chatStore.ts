import { create } from 'zustand'
import { ChatStore, ChatMessage } from '@/types/chat'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'

// Note: message list itself is not stored here — components use
// useQuery(api.chat.getMessages) for reactive updates.
// This store holds UI state and the send action only.

const initialState = {
  overlayVisible: false,
  chatMode: null as ChatStore['chatMode'],
  isPaused: false,
  error: null as ChatStore['error'],
  isLoading: false,
  // kept for components that haven't migrated to useQuery yet
  messages: [] as ChatMessage[],
}

export const useChatStore = create<ChatStore>((set, get) => ({
  ...initialState,

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages.slice(-99), message],
    }))
  },

  setMessages: (messages) => set({ messages }),

  toggleOverlay: () => {
    set((state) => ({
      overlayVisible: !state.overlayVisible,
      chatMode: state.chatMode === 'overlay' ? null : 'overlay',
    }))
  },

  toggleFullChat: () => {
    set((state) => ({
      chatMode: state.chatMode === 'full' ? null : 'full',
      overlayVisible: false,
    }))
  },

  closeChat: () => set({ chatMode: null, overlayVisible: false }),
  setMode: (mode) => set({ chatMode: mode }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  clearMessages: () => set({ messages: [] }),
  setError: (error) => set({ error }),

  // no-op: messages are now fetched reactively via useQuery in components
  initializeChat: async () => {},

  sendMessage: async (walletAddress: string, message: string) => {
    try {
      await convex.mutation(api.chat.sendMessage, { walletAddress, message })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error : new Error('Failed to send message') })
      return false
    }
  },
}))
