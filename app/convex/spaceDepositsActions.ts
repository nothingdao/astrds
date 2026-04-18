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

const TREASURY_WALLET = 'CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF'

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

// Poll until tx is confirmed, up to maxAttempts × 2s.
const fetchConfirmedTx = async (connection: Connection, sig: string, maxAttempts = 5) => {
  for (let i = 0; i < maxAttempts; i++) {
    const tx = await connection.getTransaction(sig, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    if (tx) return tx
    await new Promise((r) => setTimeout(r, 2000))
  }
  return null
}

// Parse the actual token amount received by the treasury wallet from a tx.
// Derives the treasury ATA addresses for both token programs and matches by
// account index in the tx — never relies on the optional 'owner' field.
const parseTreasuryTokenDelta = (
  tx: Awaited<ReturnType<Connection['getTransaction']>>,
  mintAddress: string
): bigint => {
  const pre = tx?.meta?.preTokenBalances ?? []
  const post = tx?.meta?.postTokenBalances ?? []
  const accountKeys =
    tx?.transaction.message.staticAccountKeys?.map((k: PublicKey) => k.toString()) ?? []

  const mintPubkey = new PublicKey(mintAddress)
  const authorityPubkey = new PublicKey(TREASURY_WALLET)

  let bestDelta = BigInt(0)
  for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
    try {
      const ata = getAssociatedTokenAddressSync(
        mintPubkey, authorityPubkey, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID
      )
      const idx = accountKeys.indexOf(ata.toString())
      if (idx === -1) continue

      const preEntry = pre.find((b) => b.accountIndex === idx)
      const postEntry = post.find((b) => b.accountIndex === idx)

      const postRaw = BigInt(postEntry?.uiTokenAmount.amount ?? '0')
      const preRaw = BigInt(preEntry?.uiTokenAmount.amount ?? '0')
      const delta = postRaw - preRaw
      if (delta > bestDelta) bestDelta = delta
    } catch {
      // Invalid mint or ATA derivation failed — skip
    }
  }

  return bestDelta
}

// ── verifyAndConfirmDeposit ───────────────────────────────────────────────────
// Called by SendToSpaceOverlay after submitting the tx signature to Convex.
// Verifies the tx on-chain, reads the actual token delta, and activates the
// pending deposit. This is the fallback path when the Helius webhook hasn't
// fired yet (or as the primary path if webhook is not configured).
export const verifyAndConfirmDeposit = action({
  args: {
    depositId: v.id('spaceDeposits'),
  },
  handler: async (ctx, { depositId }) => {
    const deposit = await ctx.runQuery(internal.spaceDeposits.getDeposit, { depositId })
    if (!deposit) throw new Error('Deposit not found')
    if (deposit.status === 'active') return { success: true, totalAmount: deposit.totalAmount }
    if (!deposit.txSignature) throw new Error('No tx signature on deposit — call submitDepositTransaction first')

    const connection = getConnection()
    const tx = await fetchConfirmedTx(connection, deposit.txSignature)
    if (!tx) throw new Error('Transaction not found after retries')
    if (tx.meta?.err) throw new Error('Transaction failed on-chain')

    const accountKeys =
      tx.transaction.message.staticAccountKeys?.map((k: PublicKey) => k.toString()) ?? []
    if (!accountKeys.includes(TREASURY_WALLET)) {
      throw new Error('Transaction did not involve treasury wallet')
    }

    const delta = parseTreasuryTokenDelta(tx, deposit.mintAddress)
    if (delta <= BigInt(0)) throw new Error('No tokens received by treasury in this transaction')

    const totalAmount = Number(delta)
    await ctx.runMutation(internal.spaceDeposits.confirmDeposit, {
      depositId,
      totalAmount,
      depositedAt: (tx.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
    })

    return { success: true, totalAmount }
  },
})

// ── reconcilePool ─────────────────────────────────────────────────────────────
export const reconcilePool = internalAction({
  args: { mintAddress: v.string() },
  handler: async (ctx, { mintAddress }) => {
    const connection = getConnection()
    const mintPubkey = new PublicKey(mintAddress)
    const authorityPubkey = new PublicKey(TREASURY_WALLET)

    let onChainBalance = 0
    for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
      try {
        const ata = getAssociatedTokenAddressSync(
          mintPubkey, authorityPubkey, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID
        )
        const acct = await getAccount(connection, ata, 'confirmed', programId)
        onChainBalance = Number(acct.amount)
        break
      } catch {
        // ATA doesn't exist for this program — try next
      }
    }

    const deposit = await ctx.runQuery(internal.spaceDeposits.getDepositByMint, { mintAddress })
    if (!deposit) return { reconciled: false, reason: 'no active pool' }

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

      const mintPubkey = new PublicKey(deposit.mintAddress)
      const authorityPubkey = new PublicKey(TREASURY_WALLET)

      let onChainBalance = 0
      for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
        try {
          const ata = getAssociatedTokenAddressSync(
            mintPubkey, authorityPubkey, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID
          )
          const acct = await getAccount(connection, ata, 'confirmed', programId)
          onChainBalance = Number(acct.amount)
          break
        } catch {
          // ATA doesn't exist for this program — try next
        }
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
    if (pending.length === 0) return { success: true, results: [] }

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
      const deposit = await ctx.runQuery(internal.spaceDeposits.getDeposit, { depositId })
      if (!deposit) continue

      const totalAmount = cols.reduce((sum, c) => sum + c.amount, 0)
      if (totalAmount <= 0 || !deposit.poolAddress) {
        continue
      }

      const claimId = randomBytes(32)
      const poolPubkey = new PublicKey(deposit.poolAddress)
      const message = buildClaimMessage(playerPubkey, poolPubkey, totalAmount, claimId, expiry)
      const signature = nacl.sign.detached(message, authority.secretKey)

      claims.push({
        depositId: String(depositId),
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
