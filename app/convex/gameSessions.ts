import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    return await ctx.db.insert('gameSessions', {
      walletAddress,
      score: 0,
      levelReached: 1,
      pillsCollected: 0,
      sessionStart: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: 'active',
    })
  },
})

export const update = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    score: v.optional(v.number()),
    levelReached: v.optional(v.number()),
    pillsCollected: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal('active'), v.literal('ending'), v.literal('ended'))
    ),
  },
  handler: async (ctx, { sessionId, ...fields }) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error('Session not found')

    const updates: Record<string, unknown> = { lastUpdated: new Date().toISOString() }
    if (fields.score !== undefined) updates.score = fields.score
    if (fields.levelReached !== undefined) updates.levelReached = fields.levelReached
    if (fields.pillsCollected !== undefined) updates.pillsCollected = fields.pillsCollected
    if (fields.status !== undefined) {
      updates.status = fields.status
      if (fields.status === 'ended') updates.sessionEnd = new Date().toISOString()
    }

    await ctx.db.patch(sessionId, updates)
    return await ctx.db.get(sessionId)
  },
})

export const incrementPillsCollected = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, amount }) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error('Session not found')

    const nextAmount = Math.max(0, amount ?? 1)
    await ctx.db.patch(sessionId, {
      pillsCollected: (session.pillsCollected ?? 0) + nextAmount,
      lastUpdated: new Date().toISOString(),
    })

    return await ctx.db.get(sessionId)
  },
})

export const get = query({
  args: { sessionId: v.id('gameSessions') },
  handler: async (ctx, { sessionId }) => ctx.db.get(sessionId),
})

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    return await ctx.db
      .query('gameSessions')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .order('desc')
      .take(50)
  },
})

export const getTotalGamesPlayed = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query('gameSessions').collect()
    return sessions.filter((session) => session.status === 'ended').length
  },
})
