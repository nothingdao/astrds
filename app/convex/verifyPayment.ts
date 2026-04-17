"use node"

import { action } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Payment verification moved on-chain. The frontend submits `game_payment`,
// waits for confirmation, then records the verified session here.
export const verifyPayment = action({
  args: {
    txSignature: v.string(),
    walletAddress: v.string(),
    paymentType: v.union(v.literal('SOL'), v.literal('ASTRDS')),
  },
  handler: async (ctx, { txSignature, walletAddress, paymentType }) => {
    await ctx.runMutation(internal.sessions.createVerifiedSession, {
      walletAddress,
      txSignature,
      paymentType,
    })

    return { success: true }
  },
})
