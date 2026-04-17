"use node"

import { action } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { Connection } from '@solana/web3.js'

const RECIPIENT_WALLET = 'AMKzF4Phzhp8htd9xerLSm1aderQT7t2v35HzbhDAjvE'

export const verifyPayment = action({
  args: {
    txSignature: v.string(),
    walletAddress: v.string(),
    paymentType: v.union(v.literal('SOL'), v.literal('ASTRDS')),
  },
  handler: async (ctx, { txSignature, walletAddress, paymentType }) => {
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
    if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')

    const connection = new Connection(rpcEndpoint, 'confirmed')

    let tx = null
    for (let i = 0; i < 5; i++) {
      tx = await connection.getTransaction(txSignature, {
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

    if (!accountKeys.includes(RECIPIENT_WALLET)) {
      throw new Error('Transaction did not involve expected recipient')
    }

    await ctx.runMutation(internal.sessions.createVerifiedSession, {
      walletAddress,
      txSignature,
      paymentType,
    })

    return { success: true }
  },
})
