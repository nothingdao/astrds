import { create } from 'zustand'
import { ChatStore } from '@/types/chat'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'

// Message list is NOT stored here — components use useQuery(api.chat.getMessages)
// This store holds UI state and the send action only.

const initialState = {
  overlayVisible: false,
  chatMode: null as ChatStore['chatMode'],
  isPaused: false,
  error: null as ChatStore['error'],
  isLoading: false,
}

export const useChatStore = create<ChatStore>((set) => ({
  ...initialState,

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
  setError: (error) => set({ error }),
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
