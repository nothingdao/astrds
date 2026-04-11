import { create } from 'zustand'
import { AuthStore } from '@/types/auth'
import { authService } from '@/auth/AuthService'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: false,
  isAuthenticating: false,
  error: null,
  walletAddress: null,
  verifiedSignature: null,
  lastVerification: null,

  authenticate: async (walletAddress) => {
    set({ isAuthenticating: true, error: null })
    try {
      const verified = await convex.query(api.sessions.isVerified, { walletAddress })
      set({
        isAuthenticated: verified,
        isAuthenticating: false,
        walletAddress: verified ? walletAddress : null,
      })
      return verified
    } catch (error) {
      set({
        error: error instanceof Error ? error : new Error('Authentication failed'),
        isAuthenticating: false,
        isAuthenticated: false,
      })
      return false
    }
  },

  verifyWallet: async (paymentType = 'SOL') => {
    set({ isAuthenticating: true, error: null })
    try {
      const success = await authService.verifyWalletSignature(
        get().walletAddress!,
        paymentType
      )
      if (success) {
        set({
          isAuthenticated: true,
          isAuthenticating: false,
          lastVerification: Date.now(),
          verifiedSignature: 'verified',
        })
        return true
      }
      throw new Error('Verification failed')
    } catch (error) {
      set({
        error: error instanceof Error ? error : new Error('Verification failed'),
        isAuthenticating: false,
        isAuthenticated: false,
      })
      return false
    }
  },

  logout: () => {
    const { walletAddress } = get()
    if (walletAddress) {
      convex.mutation(api.sessions.clearSession, { walletAddress })
    }
    set({
      isAuthenticated: false,
      walletAddress: null,
      verifiedSignature: null,
      lastVerification: null,
      error: null,
    })
  },

  clearError: () => set({ error: null }),
  setError: (error) => set({ error }),
}))
