import {
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import { connection as solanaConnection } from '@/lib/solana'
import {
  getMint,
} from '@solana/spl-token'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'
import { buildGamePaymentTransaction, sendSignedTransaction } from '@/lib/spaceVault'

const TOKEN_MINT = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const QUARTER_USD = 0.25 // $0.25 per play
const TOKEN_COST = 1000

// Simple price cache — avoid refetching on every call within the same session
let _solPriceCache: { usd: number; fetchedAt: number } | null = null
const PRICE_CACHE_TTL = 60_000 // 1 minute

async function getSolPriceUsd(): Promise<number> {
  const now = Date.now()
  if (_solPriceCache && now - _solPriceCache.fetchedAt < PRICE_CACHE_TTL) {
    return _solPriceCache.usd
  }

  try {
    const res = await fetch(
      'https://price.jup.ag/v6/price?ids=SOL'
    )
    const json = await res.json()
    const price = json?.data?.SOL?.price as number
    if (price && price > 0) {
      _solPriceCache = { usd: price, fetchedAt: now }
      return price
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: use cached value if we have one, otherwise a conservative estimate
  return _solPriceCache?.usd ?? 150
}

async function getSolCostLamports(): Promise<number> {
  const solPrice = await getSolPriceUsd()
  const solAmount = QUARTER_USD / solPrice
  return Math.ceil(solAmount * 1e9) // round up so we never under-charge
}

class AuthService {
  private connection = solanaConnection

  async getMintDecimals(): Promise<number> {
    try {
      const mintInfo = await getMint(this.connection, TOKEN_MINT)
      return mintInfo.decimals
    } catch {
      return 6
    }
  }

  async getTokenAmount(uiAmount: number): Promise<number> {
    const decimals = await this.getMintDecimals()
    return Math.floor(uiAmount * Math.pow(10, decimals))
  }

  async createPaymentTransaction(
    walletPubkey: PublicKey,
    paymentType = 'SOL'
  ): Promise<Transaction> {
    if (paymentType !== 'SOL') {
      throw new Error('ASTRDS payment is no longer supported')
    }

    const lamports = await getSolCostLamports()
    return (
      await buildGamePaymentTransaction({
        connection: this.connection,
        player: walletPubkey,
        lamports,
      })
    ).transaction
  }

  async getTokenBalance(walletPubkey: PublicKey): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, walletPubkey)
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount)
      return accountInfo.value.uiAmount || 0
    } catch {
      return 0
    }
  }

  async verifyWalletSignature(wallet: any, paymentType = 'SOL'): Promise<boolean> {
    if (!wallet.publicKey) throw new Error('No wallet connected')

    if (paymentType !== 'SOL') {
      throw new Error('ASTRDS payment is no longer supported')
    }

    {
      const lamports = await getSolCostLamports()
      const solBalance = await this.connection.getBalance(wallet.publicKey)
      if (solBalance < lamports) {
        const solAmount = (lamports / 1e9).toFixed(4)
        throw new Error(`Insufficient SOL balance. Required: ~${solAmount} SOL ($0.25)`)
      }
    }

    const built = await buildGamePaymentTransaction({
      connection: this.connection,
      player: wallet.publicKey,
      lamports: await getSolCostLamports(),
    })
    const transaction = built.transaction
    const signedTx = await wallet.signTransaction(transaction)
    const txSignature = await sendSignedTransaction({
      connection: this.connection,
      signedTransaction: signedTx,
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
    })

    await convex.action(api.verifyPayment.verifyPayment, {
      txSignature,
      walletAddress: wallet.publicKey.toString(),
      paymentType: 'SOL',
    })

    return true
  }

  async clearSession(publicKey: PublicKey): Promise<void> {
    await convex.mutation(api.sessions.clearSession, {
      walletAddress: publicKey.toString(),
    })
  }
}

export const authService = new AuthService()
