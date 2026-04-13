// Queries, internal queries, and internal mutations for space deposits.
// No "use node" — these run in the default Convex runtime.

import { internalMutation, internalQuery, query } from './_generated/server'
import { v } from 'convex/values'

// ── Public queries ────────────────────────────────────────────────────────────

export const getAllActiveSpaceDeposits = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('spaceDeposits')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()
  },
})

export const getActivePoolsForLevel = query({
  args: { level: v.number() },
  handler: async (ctx, { level }) => {
    const all = await ctx.db
      .query('spaceDeposits')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()
    return all.filter(
      (d) =>
        d.minLevel <= level &&
        d.maxLevel >= level &&
        d.remainingAmount >= d.tokensPerPill
    )
  },
})

// ── Internal queries ──────────────────────────────────────────────────────────

export const getDeposit = internalQuery({
  args: { depositId: v.id('spaceDeposits') },
  handler: async (ctx, { depositId }) => {
    return ctx.db.get(depositId)
  },
})

// ── Internal mutations ────────────────────────────────────────────────────────

export const insertDeposit = internalMutation({
  args: {
    walletAddress: v.string(),
    txSignature: v.string(),
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
    return ctx.db.insert('spaceDeposits', {
      ...args,
      remainingAmount: args.totalAmount,
      depositedAt: Date.now(),
      status: 'active',
    })
  },
})

export const decrementDeposit = internalMutation({
  args: {
    depositId: v.id('spaceDeposits'),
    amount: v.number(),
  },
  handler: async (ctx, { depositId, amount }) => {
    const deposit = await ctx.db.get(depositId)
    if (!deposit) throw new Error('Deposit not found')
    const newRemaining = Math.max(0, deposit.remainingAmount - amount)
    await ctx.db.patch(depositId, {
      remainingAmount: newRemaining,
      status: newRemaining < deposit.tokensPerPill ? 'depleted' : 'active',
    })
  },
})
