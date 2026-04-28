import { httpAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'

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

// Only callable from trusted server-side Convex functions (not the browser).
export const setAstrdsEarned = internalMutation({
  args: {
    sessionId: v.id('gameSessions'),
    amount: v.number(),
    amountRaw: v.optional(v.string()),
    allocated: v.optional(v.number()),
    burned: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, amount, amountRaw, allocated, burned }) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error('Session not found')
    await ctx.db.patch(sessionId, {
      astrdsEarned: amount,
      astrdsEarnedRaw: amountRaw,
      astrdsAllocated: allocated,
      astrdsBurned: burned,
      lastUpdated: new Date().toISOString(),
    })
  },
})

// HTTP endpoint for the game server. Validates ADMIN_API_KEY then calls
// the internal mutation — the browser never has access to call this path directly.
export const setAstrdsEarnedHttp = httpAction(async (ctx, request) => {
  const apiKey = process.env.ADMIN_API_KEY
  if (!apiKey) return new Response('Not configured', { status: 503 })

  if (request.headers.get('Authorization') !== `Bearer ${apiKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const { sessionId, amount, amountRaw, allocated, burned } = body as Record<string, unknown>
  if (typeof sessionId !== 'string' || typeof amount !== 'number' || amount < 0 || amount > 50) {
    return new Response('Invalid body', { status: 400 })
  }
  if (amountRaw !== undefined && (typeof amountRaw !== 'string' || !/^\d+$/.test(amountRaw))) {
    return new Response('Invalid amountRaw', { status: 400 })
  }

  await ctx.runMutation(internal.gameSessions.setAstrdsEarned, {
    sessionId: sessionId as Id<'gameSessions'>,
    amount,
    amountRaw: amountRaw as string | undefined,
    allocated: typeof allocated === 'number' ? allocated : undefined,
    burned: typeof burned === 'number' ? burned : undefined,
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
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

export const getInternal = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return ctx.db.get(sessionId as Id<'gameSessions'>)
  },
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
