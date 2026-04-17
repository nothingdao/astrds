// src/types/wallet.ts

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'

export interface WalletState {
  isConnected: boolean
  isConnecting: boolean
  publicKey: PublicKey | null
  error: Error | null
  balance: {
    SOL: number
    ASTRDS: number
  }
  network: WalletAdapterNetwork
  lastTransaction: string | null
}

export interface WalletActions {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (transaction: Transaction) => Promise<string>
  refreshBalance: () => Promise<void>
  setNetwork: (network: WalletAdapterNetwork) => void
  clearError: () => void
}

export type WalletStore = WalletState & WalletActions

export interface WalletConnectionProps {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}
