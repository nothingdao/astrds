"use node"

// Node.js actions for space deposits — on-chain verification and token transfers.

import { action } from './_generated/server'
import { internal } from './_generated/api'
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
  createTransferInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

// Space token deposits go to the authority wallet so it can sign outbound claims.
const TREASURY_WALLET = 'CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF'

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY
  if (!raw) throw new Error('PROGRAM_AUTHORITY_PRIVATE_KEY not set')
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))
}

export const recordDeposit = action({
  args: {
    txSignature: v.string(),
    walletAddress: v.string(),
    mintAddress: v.string(),
    programId: v.string(),
    symbol: v.string(),
    name: v.string(),
    logoUri: v.optional(v.string()),
    decimals: v.number(),
    totalAmount: v.number(),
    tokensPerPill: v.number(),
    minLevel: v.number(),
    maxLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
    if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')

    const connection = new Connection(rpcEndpoint, 'confirmed')

    let tx = null
    for (let i = 0; i < 5; i++) {
      tx = await connection.getTransaction(args.txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })
      if (tx) break
      await new Promise((r) => setTimeout(r, 2000))
    }

    if (!tx) throw new Error('Transaction not found after retries')
    if (tx.meta?.err) throw new Error('Transaction failed on-chain')

    const accountKeys =
      tx.transaction.message.staticAccountKeys?.map((k) => k.toString()) ?? []

    if (!accountKeys.includes(TREASURY_WALLET)) {
      throw new Error('Transaction did not involve treasury wallet')
    }

    const depositId = await ctx.runMutation(internal.spaceDeposits.insertDeposit, {
      walletAddress: args.walletAddress,
      txSignature: args.txSignature,
      mintAddress: args.mintAddress,
      programId: args.programId,
      symbol: args.symbol,
      name: args.name,
      logoUri: args.logoUri,
      decimals: args.decimals,
      totalAmount: args.totalAmount,
      tokensPerPill: args.tokensPerPill,
      minLevel: args.minLevel,
      maxLevel: args.maxLevel,
    })

    return { success: true, depositId }
  },
})

export const claimSpaceTokens = action({
  args: {
    depositId: v.id('spaceDeposits'),
    playerWalletAddress: v.string(),
    pillCount: v.number(),
  },
  handler: async (ctx, { depositId, playerWalletAddress, pillCount }) => {
    if (pillCount <= 0) return { success: true, signature: null, totalClaimed: 0 }

    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
    if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')

    const deposit = await ctx.runQuery(internal.spaceDeposits.getDeposit, { depositId })
    if (!deposit) throw new Error('Deposit not found')
    if (deposit.status !== 'active') throw new Error('Deposit is no longer active')

    // Dev-seeded deposits have no real treasury funds — skip on-chain transfer
    if (deposit.txSignature.startsWith('dev-seed-')) {
      const claimable = Math.min(pillCount * deposit.tokensPerPill, deposit.remainingAmount)
      if (claimable > 0) {
        await ctx.runMutation(internal.spaceDeposits.decrementDeposit, { depositId, amount: claimable })
      }
      return { success: true, signature: null, totalClaimed: claimable }
    }

    const claimable = Math.min(
      pillCount * deposit.tokensPerPill,
      deposit.remainingAmount
    )
    if (claimable <= 0) return { success: true, signature: null, totalClaimed: 0 }

    const authority = loadAuthority()
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const mintPubkey = new PublicKey(deposit.mintAddress)
    const playerPubkey = new PublicKey(playerWalletAddress)
    const authorityPubkey = authority.publicKey

    // Resolve the correct token program by finding which treasury ATA actually holds tokens.
    // The stored programId may be wrong (e.g., TOKEN_2022 token listed under TOKEN accounts),
    // so we probe both and use whichever has a balance.
    const candidatePrograms = [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]
    let tokenProgramId = deposit.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

    let resolvedTreasuryAta = getAssociatedTokenAddressSync(
      mintPubkey, authorityPubkey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // Try to find which program's ATA actually holds the claimable amount
    for (const programId of candidatePrograms) {
      const candidateAta = getAssociatedTokenAddressSync(
        mintPubkey, authorityPubkey, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID
      )
      try {
        const acct = await getAccount(connection, candidateAta, 'confirmed', programId)
        if (acct.amount >= BigInt(claimable)) {
          tokenProgramId = programId
          resolvedTreasuryAta = candidateAta
          break
        }
      } catch {
        // account doesn't exist for this program — try next
      }
    }

    const treasuryAta = resolvedTreasuryAta
    const playerAta = getAssociatedTokenAddressSync(
      mintPubkey, playerPubkey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // Final balance check with helpful diagnostics if still insufficient
    try {
      const treasuryAccount = await getAccount(connection, treasuryAta, 'confirmed', tokenProgramId)
      if (treasuryAccount.amount < BigInt(claimable)) {
        throw new Error(
          `Treasury ATA ${treasuryAta.toString()} has ${treasuryAccount.amount} of ${deposit.symbol}, need ${claimable}. ` +
          `Authority: ${authorityPubkey.toString()}`
        )
      }
    } catch (err: any) {
      if (err.message?.includes('Treasury ATA')) throw err
      throw new Error(
        `Treasury ATA ${treasuryAta.toString()} not found for ${deposit.symbol}. ` +
        `Authority: ${authorityPubkey.toString()}. ${err.message}`
      )
    }

    const transferTx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        authorityPubkey,
        playerAta,
        playerPubkey,
        mintPubkey,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createTransferInstruction(
        treasuryAta,
        playerAta,
        authorityPubkey,
        BigInt(claimable),
        [],
        tokenProgramId
      )
    )

    const signature = await sendAndConfirmTransaction(connection, transferTx, [authority])

    await ctx.runMutation(internal.spaceDeposits.decrementDeposit, {
      depositId,
      amount: claimable,
    })

    return { success: true, signature, totalClaimed: claimable }
  },
})
