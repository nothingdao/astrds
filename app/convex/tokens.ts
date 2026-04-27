"use node"

import { action } from './_generated/server'
import { v } from 'convex/values'
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import nacl from 'tweetnacl'
import { internal } from './_generated/api'

const MINT_ADDRESS = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const TOKEN_DECIMALS = 9
// Max ASTRDS any emission tier can award per game (100 pills × 0.5 = 50 at tier 5).
// Checked server-side before minting.
const MAX_ASTRDS_PER_GAME = 50

const toU64LeBytes = (value: bigint): Buffer => {
  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64LE(value)
  return bytes
}

const toI64LeBytes = (value: bigint): Buffer => {
  const bytes = Buffer.alloc(8)
  bytes.writeBigInt64LE(value)
  return bytes
}

const buildMintMessage = (
  player: PublicKey,
  amount: bigint,
  sessionId: Uint8Array,
  expiry: number
): Buffer =>
  Buffer.concat([
    player.toBuffer(),
    toU64LeBytes(amount),
    Buffer.from(sessionId),
    toI64LeBytes(BigInt(expiry)),
  ])

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY
  if (!raw) throw new Error('PROGRAM_AUTHORITY_PRIVATE_KEY not set')
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))
}

export const mintTokens = action({
  args: {
    playerPublicKey: v.string(),
    tokenCount: v.number(),
    gameSessionId: v.optional(v.string()),
  },
  handler: async (ctx, { playerPublicKey, tokenCount, gameSessionId }) => {
    if (!Number.isInteger(tokenCount) || tokenCount <= 0 || tokenCount > MAX_ASTRDS_PER_GAME) {
      throw new Error(`Invalid token count: must be a whole number between 1 and ${MAX_ASTRDS_PER_GAME}`)
    }

    // Verify against the authoritative astrdsEarned written by the game server.
    // If no session ID is supplied (legacy path), skip verification.
    if (gameSessionId) {
      const session = await ctx.runQuery(internal.gameSessions.getInternal, {
        sessionId: gameSessionId,
      })
      if (!session) throw new Error('Game session not found')
      if (session.astrdsEarned === undefined) {
        throw new Error('ASTRDS amount not yet recorded for this session — game server may still be submitting game over')
      }
      if (tokenCount > session.astrdsEarned) {
        throw new Error(`Claimed amount (${tokenCount}) exceeds earned amount (${session.astrdsEarned})`)
      }
    }

    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
    if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')

    const authority = loadAuthority()
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const playerPubkey = new PublicKey(playerPublicKey)

    const ata = getAssociatedTokenAddressSync(
      MINT_ADDRESS,
      playerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const amount = BigInt(tokenCount) * BigInt(10 ** TOKEN_DECIMALS)

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey,
        ata,
        playerPubkey,
        MINT_ADDRESS,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        MINT_ADDRESS,
        ata,
        authority.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    )

    const signature = await sendAndConfirmTransaction(connection, tx, [authority])

    return { success: true, signature }
  },
})

// Returns a signed mint authorization. The client uses this with
// buildMintAstrdsTransaction to submit an on-chain mint_astrds instruction.
export const prepareMint = action({
  args: {
    playerWalletAddress: v.string(),
    tokenCount: v.number(),
    gameSessionId: v.string(),
  },
  handler: async (ctx, { playerWalletAddress, tokenCount, gameSessionId }) => {
    if (!Number.isInteger(tokenCount) || tokenCount <= 0 || tokenCount > MAX_ASTRDS_PER_GAME) {
      throw new Error(`Invalid token count: must be a whole number between 1 and ${MAX_ASTRDS_PER_GAME}`)
    }

    // Poll until the game server writes astrdsEarned (it does so async after game over).
    let session = null
    for (let attempt = 0; attempt < 8; attempt++) {
      session = await ctx.runQuery(internal.gameSessions.getInternal, { sessionId: gameSessionId })
      if (session?.astrdsEarned !== undefined) break
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    if (!session) throw new Error('Game session not found')
    if (session.astrdsEarned === undefined) {
      throw new Error('Game server has not submitted your final score yet — please wait a moment and try again')
    }
    if (tokenCount > session.astrdsEarned) {
      throw new Error(`Claimed amount (${tokenCount}) exceeds earned amount (${session.astrdsEarned})`)
    }

    const authority = loadAuthority()
    const playerPubkey = new PublicKey(playerWalletAddress)
    const expiry = Math.floor(Date.now() / 1000) + 5 * 60

    // Encode game session ID as 32-byte identifier (UTF-8, zero-padded).
    // The on-chain MintRecord PDA uses this for replay protection.
    const sessionIdBytes = new Uint8Array(32)
    const encoded = Buffer.from(gameSessionId, 'utf8')
    sessionIdBytes.set(encoded.subarray(0, 32))

    const rawAmount = BigInt(tokenCount) * BigInt(10 ** TOKEN_DECIMALS)
    const message = buildMintMessage(playerPubkey, rawAmount, sessionIdBytes, expiry)
    const signature = nacl.sign.detached(message, authority.secretKey)

    return {
      // Send as string to survive JSON serialization without precision loss.
      amount: rawAmount.toString(),
      sessionId: Array.from(sessionIdBytes),
      expiry,
      signature: Array.from(signature),
    }
  },
})
