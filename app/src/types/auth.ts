// src/types/auth.ts

export interface AuthState {
  isAuthenticated: boolean
  isAuthenticating: boolean
  error: Error | null
  walletAddress: string | null
  verifiedSignature: string | null
  lastVerification: number | null
}

export interface AuthActions {
  authenticate: (walletAddress: string) => Promise<boolean>
  verifyWallet: (paymentType?: 'SOL' | 'ASTRDS') => Promise<boolean>
  logout: () => void
  clearError: () => void
  setError: (error: Error) => void
}

export type AuthStore = AuthState & AuthActions

export interface AuthScreenProps {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export interface WalletAuthProps {
  onVerification?: (success: boolean) => void
  paymentType?: 'SOL' | 'ASTRDS'
}
