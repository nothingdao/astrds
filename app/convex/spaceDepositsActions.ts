"use node"

// Node.js actions for space deposits — on-chain verification and token transfers.

import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { randomBytes } from 'node:crypto'
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import nacl from 'tweetnacl'

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY
  if (!raw) throw new Error('PROGRAM_AUTHORITY_PRIVATE_KEY not set')
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))
}

const getConnection = (): Connection => {
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
  if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')
  return new Connection(rpcEndpoint, 'confirmed')
}

// ── verifyAndConfirmDeposit ───────────────────────────────────────────────────
// Server-side verification of a deposit. Reads the vault ATA balance directly
// from chain using the poolAddress set by confirmDepositFromChain. Called after
// the client-side confirmDepositFromChain as an independent cross-check.
export const verifyAndConfirmDeposit = action({
  args: {
    depositId: v.id('spaceDeposits'),
  },
  handler: async (ctx, { depositId }) => {
    const deposit = await ctx.runQuery(internal.spaceDeposits.getDeposit, { depositId })
    if (!deposit) throw new Error('Deposit not found')
    if (deposit.status === 'active') return { success: true, totalAmount: deposit.totalAmount }
    if (!deposit.poolAddress) throw new Error('No pool address — confirmDepositFromChain must run first')

    const connection = getConnection()
    const mintPubkey = new PublicKey(deposit.mintAddress)
    const depositPoolPubkey = new PublicKey(deposit.poolAddress)
    const programId = deposit.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

    const vaultAta = getAssociatedTokenAddressSync(
      mintPubkey, depositPoolPubkey, true, programId, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    let onChainBalance = 0
    try {
      const acct = await getAccount(connection, vaultAta, 'confirmed', programId)
      onChainBalance = Number(acct.amount)
    } catch {
      throw new Error('Vault ATA not found — deposit may not have confirmed on-chain yet')
    }

    if (onChainBalance <= 0) throw new Error('Vault ATA is empty')

    await ctx.runMutation(internal.spaceDeposits.confirmDeposit, {
      depositId,
      totalAmount: onChainBalance,
      depositedAt: Date.now(),
    })

    return { success: true, totalAmount: onChainBalance }
  },
})

// ── reconcilePool ─────────────────────────────────────────────────────────────
// Reads the vault ATA balance owned by the DepositPool PDA and caps Convex's
// remainingAmount to on-chain reality. Triggered by webhook drain detection or
// called directly for maintenance.
export const reconcilePool = internalAction({
  args: { mintAddress: v.string() },
  handler: async (ctx, { mintAddress }) => {
    const deposit = await ctx.runQuery(internal.spaceDeposits.getDepositByMint, { mintAddress })
    if (!deposit) return { reconciled: false, reason: 'no active pool' }
    if (!deposit.poolAddress) return { reconciled: false, reason: 'no pool address on record' }

    const connection = getConnection()
    const mintPubkey = new PublicKey(mintAddress)
    const depositPoolPubkey = new PublicKey(deposit.poolAddress)
    const programId = deposit.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

    const vaultAta = getAssociatedTokenAddressSync(
      mintPubkey, depositPoolPubkey, true, programId, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    let onChainBalance = 0
    try {
      const acct = await getAccount(connection, vaultAta, 'confirmed', programId)
      onChainBalance = Number(acct.amount)
    } catch {
      // Vault ATA doesn't exist — pool is empty
    }

    await ctx.runMutation(internal.spaceDeposits.reconcilePoolBalance, {
      depositId: deposit._id,
      onChainBalance,
    })

    return { reconciled: true, onChainBalance }
  },
})

// ── reconcileAllPools ─────────────────────────────────────────────────────────
export const reconcileAllPools = internalAction({
  args: {},
  handler: async (ctx) => {
    const deposits = await ctx.runQuery(internal.spaceDeposits.getAllActiveDeposits)
    const connection = getConnection()

    for (const deposit of deposits) {
      if (deposit.txSignature.startsWith('dev-seed-')) continue
      if (!deposit.poolAddress) continue

      const mintPubkey = new PublicKey(deposit.mintAddress)
      const depositPoolPubkey = new PublicKey(deposit.poolAddress)
      const programId = deposit.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

      const vaultAta = getAssociatedTokenAddressSync(
        mintPubkey, depositPoolPubkey, true, programId, ASSOCIATED_TOKEN_PROGRAM_ID
      )

      let onChainBalance = 0
      try {
        const acct = await getAccount(connection, vaultAta, 'confirmed', programId)
        onChainBalance = Number(acct.amount)
      } catch {
        // Vault ATA doesn't exist — pool is empty
      }

      await ctx.runMutation(internal.spaceDeposits.reconcilePoolBalance, {
        depositId: deposit._id,
        onChainBalance,
      })
    }
  },
})

const toU64LeBytes = (value: number): Buffer => {
  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64LE(BigInt(value))
  return bytes
}

const toI64LeBytes = (value: number): Buffer => {
  const bytes = Buffer.alloc(8)
  bytes.writeBigInt64LE(BigInt(value))
  return bytes
}

const buildClaimMessage = (
  player: PublicKey,
  pool: PublicKey,
  amount: number,
  claimId: Uint8Array,
  expiry: number
): Buffer =>
  Buffer.concat([
    player.toBuffer(),
    pool.toBuffer(),
    toU64LeBytes(amount),
    Buffer.from(claimId),
    toI64LeBytes(expiry),
  ])

// ── prepareClaims ─────────────────────────────────────────────────────────────
// Convex remains the reservation system. It signs claim messages for the
// frontend, which then submits ed25519 + claim instructions on-chain.
export const prepareClaims = action({
  args: {
    playerWalletAddress: v.string(),
  },
  handler: async (ctx, { playerWalletAddress }) => {
    const pending = await ctx.runQuery(
      internal.spaceDeposits.getPendingCollectionsForClaim,
      { playerWalletAddress }
    )
    if (pending.length === 0) return { success: true, claims: [] }

    // Group collection records by depositId.
    const byDeposit = new Map<string, typeof pending>()
    for (const col of pending) {
      const key = col.depositId as string
      if (!byDeposit.has(key)) byDeposit.set(key, [])
      byDeposit.get(key)!.push(col)
    }

    const authority = loadAuthority()
    const playerPubkey = new PublicKey(playerWalletAddress)
    const expiry = Math.floor(Date.now() / 1000) + 5 * 60
    const claims: {
      depositId: string
      collectionIds: string[]
      poolAddress: string
      mintAddress: string
      programId: string
      symbol: string
      decimals: number
      totalAmount: number
      claimId: number[]
      expiry: number
      signature: number[]
    }[] = []

    for (const [, cols] of byDeposit) {
      const depositId = cols[0].depositId
      let deposit = await ctx.runQuery(internal.spaceDeposits.getDeposit, { depositId })
      // depositId may be stale (e.g. after a clearAllDeposits + re-sync).
      // Fall back to finding the active pool by mintAddress.
      if (!deposit) {
        deposit = await ctx.runQuery(internal.spaceDeposits.getDepositByMint, { mintAddress: cols[0].mintAddress })
      }
      if (!deposit || !deposit.poolAddress) continue

      const totalAmount = cols.reduce((sum, c) => sum + c.amount, 0)
      if (totalAmount <= 0) continue

      const claimId = randomBytes(32)
      const poolPubkey = new PublicKey(deposit.poolAddress)
      const message = buildClaimMessage(playerPubkey, poolPubkey, totalAmount, claimId, expiry)
      const signature = nacl.sign.detached(message, authority.secretKey)

      claims.push({
        depositId: String(deposit._id),
        collectionIds: cols.map((c) => String(c._id)),
        poolAddress: deposit.poolAddress,
        mintAddress: deposit.mintAddress,
        programId: deposit.programId,
        symbol: deposit.symbol,
        decimals: deposit.decimals ?? 6,
        totalAmount,
        claimId: Array.from(claimId),
        expiry,
        signature: Array.from(signature),
      })
    }

    return { success: true, claims }
  },
})
