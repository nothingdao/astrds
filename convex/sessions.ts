import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'

const SESSION_TTL_MS = 30 * 60 * 1000

export const createVerifiedSession = internalMutation({
  args: {
    walletAddress: v.string(),
    txSignature: v.string(),
    paymentType: v.union(v.literal('SOL'), v.literal('ASTRDS')),
  },
  handler: async (ctx, { walletAddress, txSignature, paymentType }) => {
    const now = Date.now()
    await ctx.db.insert('verifiedSessions', {
      walletAddress,
      txSignature,
      paymentType,
      verifiedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    })
  },
})

export const isVerified = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const session = await ctx.db
      .query('verifiedSessions')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .order('desc')
      .first()
    if (!session) return false
    return session.expiresAt > Date.now()
  },
})

export const clearSession = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const sessions = await ctx.db
      .query('verifiedSessions')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .collect()
    await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
  },
})
