// src/hooks/useAuth.ts
import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { authService } from '@/auth/AuthService'

export const useAuth = () => {
  const wallet = useWallet()
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState(null)

  const verifyWallet = useCallback(
    async (paymentType = 'SOL') => {
      if (!wallet.connected) {
        setError('Please connect your wallet')
        return false
      }

      setIsVerifying(true)
      setError(null)

      try {
        const success = await authService.verifyWalletSignature(
          wallet,
          paymentType
        )
        return success
      } catch (err) {
        console.error('Verification error:', err)
        setError(err.message)
        return false
      } finally {
        setIsVerifying(false)
      }
    },
    [wallet]
  )

  const clearAuth = useCallback(() => {
    if (wallet.publicKey) {
      authService.clearSession(wallet.publicKey)
    }
  }, [wallet.publicKey])

  return {
    isVerifying,
    error,
    verifyWallet,
    clearAuth,
  }
}
