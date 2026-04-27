import {
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import { connection as solanaConnection } from '@/lib/solana'
import {
  getMint,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'
import { buildGamePaymentTransaction, sendSignedTransaction } from '@/lib/spaceVault'

const TOKEN_MINT = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const TOKEN_COST = 1000

let _quarterUsdCache: { value: number; fetchedAt: number } | null = null

async function getQuarterUsd(): Promise<number> {
  const now = Date.now()
  if (_quarterUsdCache && now - _quarterUsdCache.fetchedAt < 60_000) {
    return _quarterUsdCache.value
  }
  try {
    const config = await convex.query(api.admin.getGameConfig, {})
    const value = config?.quarterUsd ?? 0.25
    _quarterUsdCache = { value, fetchedAt: now }
    return value
  } catch {
    return _quarterUsdCache?.value ?? 0.25
  }
}

// Simple price cache — avoid refetching on every call within the same session
let _solPriceCache: { usd: number; fetchedAt: number } | null = null
const PRICE_CACHE_TTL = 60_000 // 1 minute

async function getSolPriceUsd(): Promise<number> {
  const now = Date.now()
  if (_solPriceCache && now - _solPriceCache.fetchedAt < PRICE_CACHE_TTL) {
    return _solPriceCache.usd
  }

  const result = await convex.action(api.prices.getSolUsdPrice, { maxAgeMs: PRICE_CACHE_TTL })
  const price = Number(result.priceUsd)
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Unable to fetch a valid SOL/USD price')
  }

  _solPriceCache = { usd: price, fetchedAt: now }
  return price
}

async function getSolCostLamports(): Promise<number> {
  const [solPrice, quarterUsd] = await Promise.all([getSolPriceUsd(), getQuarterUsd()])
  const solAmount = quarterUsd / solPrice
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
      const tokenAccount = getAssociatedTokenAddressSync(TOKEN_MINT, walletPubkey)
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

    console.log('[insert-quarter] building game payment transaction')
    const built = await buildGamePaymentTransaction({
      connection: this.connection,
      player: wallet.publicKey,
      lamports: await getSolCostLamports(),
    })
    const transaction = built.transaction
    console.log('[insert-quarter] built transaction, requesting wallet signature', {
      instructions: transaction.instructions.length,
      wallet: wallet.publicKey.toString(),
    })

    let txSignature: string
    if (wallet.sendTransaction) {
      txSignature = await wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      await this.connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash: built.blockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        'confirmed'
      )
    } else {
      const signedTx = await wallet.signTransaction(transaction)
      txSignature = await sendSignedTransaction({
        connection: this.connection,
        signedTransaction: signedTx,
        blockhash: built.blockhash,
        lastValidBlockHeight: built.lastValidBlockHeight,
      })
    }
    console.log('[insert-quarter] payment transaction confirmed', txSignature)

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
