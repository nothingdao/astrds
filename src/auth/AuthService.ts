import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'

const RECIPIENT_WALLET = new PublicKey(
  'AMKzF4Phzhp8htd9xerLSm1aderQT7t2v35HzbhDAjvE'
)
const TOKEN_MINT = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const SOL_COST = 0.05
const TOKEN_COST = 1000

class AuthService {
  private connection: Connection

  constructor() {
    this.connection = new Connection(import.meta.env.VITE_SOLANA_RPC_ENDPOINT)
  }

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

  async ensureTokenAccount(
    walletPubkey: PublicKey,
    isSource = true
  ): Promise<PublicKey | null> {
    const tokenAddress = await getAssociatedTokenAddress(
      TOKEN_MINT,
      isSource ? walletPubkey : RECIPIENT_WALLET
    )
    try {
      await getAccount(this.connection, tokenAddress)
      return tokenAddress
    } catch {
      return null
    }
  }

  async createPaymentTransaction(
    walletPubkey: PublicKey,
    paymentType = 'SOL'
  ): Promise<Transaction> {
    const transaction = new Transaction()

    if (paymentType === 'SOL') {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: walletPubkey,
          toPubkey: RECIPIENT_WALLET,
          lamports: SOL_COST * 1e9,
        })
      )
    } else if (paymentType === 'ASTRDS') {
      const tokenAmount = await this.getTokenAmount(TOKEN_COST)
      const fromTokenAddress = await getAssociatedTokenAddress(TOKEN_MINT, walletPubkey)
      const toTokenAddress = await getAssociatedTokenAddress(TOKEN_MINT, RECIPIENT_WALLET)
      const fromAccountExists = await this.ensureTokenAccount(walletPubkey, true)
      const toAccountExists = await this.ensureTokenAccount(RECIPIENT_WALLET, false)

      if (!fromAccountExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            walletPubkey, fromTokenAddress, walletPubkey, TOKEN_MINT
          )
        )
      }
      if (!toAccountExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            walletPubkey, toTokenAddress, RECIPIENT_WALLET, TOKEN_MINT
          )
        )
      }
      transaction.add(
        createTransferInstruction(
          fromTokenAddress, toTokenAddress, walletPubkey, tokenAmount, [], TOKEN_PROGRAM_ID
        )
      )
    }

    return transaction
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

    if (paymentType === 'ASTRDS') {
      const tokenBalance = await this.getTokenBalance(wallet.publicKey)
      if (tokenBalance < TOKEN_COST) {
        throw new Error(`Insufficient ASTRDS balance. Required: ${TOKEN_COST} ASTRDS`)
      }
    } else {
      const solBalance = await this.connection.getBalance(wallet.publicKey)
      if (solBalance < SOL_COST * 1e9) {
        throw new Error(`Insufficient SOL balance. Required: ${SOL_COST} SOL`)
      }
    }

    const transaction = await this.createPaymentTransaction(wallet.publicKey, paymentType)
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet.publicKey

    const signedTx = await wallet.signTransaction(transaction)
    const txSignature = await this.connection.sendRawTransaction(
      signedTx.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    )

    await this.connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight })

    // Verify server-side via Convex action
    await convex.action(api.verifyPayment.verifyPayment, {
      txSignature,
      walletAddress: wallet.publicKey.toString(),
      paymentType: paymentType as 'SOL' | 'ASTRDS',
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
