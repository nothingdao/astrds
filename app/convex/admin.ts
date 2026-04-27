import { v } from 'convex/values'
import { httpAction, internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'

// Wallets allowed to save config directly via the Convex mutation (no API key needed).
// The HTTP endpoint is still available for scripted access with ADMIN_API_KEY.
const DEV_WALLETS = new Set([
  'jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE', // deployer / upgrade authority
  'FEb3tauuDVbcErhewnDCFeM2Lt6ddRMwme23UY3ANebg', // astrds player 1
])

export const DEFAULT_TIER_BREAKPOINTS = [0.0024, 0.01, 0.05, 0.1]
export const DEFAULT_PILLS_PER_TIER   = [5, 10, 25, 50, 100]
export const DEFAULT_ASTRDS_PER_PILL  = [10, 5, 2, 1, 0.5]

export const DEFAULT_CONFIG = {
  version: 1,
  applyToRunning: false,
  powerupSpawnDelayMs: 15000,
  shipPickupSpawnDelayMs: 20000,
  maxPowerupsOnScreen: 2,
  powerupDurationMs: 10000,
  maxLives: 5,
  quarterUsd: 0.25,
  tierBreakpointsUsd: DEFAULT_TIER_BREAKPOINTS,
  pillsPerTier: DEFAULT_PILLS_PER_TIER,
  astrdsPerPill: DEFAULT_ASTRDS_PER_PILL,
}

export const getGameConfig = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query('gameConfig').first()
    if (!doc) return DEFAULT_CONFIG
    return {
      ...DEFAULT_CONFIG,
      ...doc,
      // Ensure array fields fall back to defaults if missing
      tierBreakpointsUsd: doc.tierBreakpointsUsd ?? DEFAULT_TIER_BREAKPOINTS,
      pillsPerTier: doc.pillsPerTier ?? DEFAULT_PILLS_PER_TIER,
      astrdsPerPill: doc.astrdsPerPill ?? DEFAULT_ASTRDS_PER_PILL,
      quarterUsd: doc.quarterUsd ?? 0.25,
    }
  },
})

const CONFIG_ARGS = {
  applyToRunning: v.boolean(),
  powerupSpawnDelayMs: v.number(),
  shipPickupSpawnDelayMs: v.number(),
  maxPowerupsOnScreen: v.number(),
  powerupDurationMs: v.number(),
  maxLives: v.number(),
  quarterUsd: v.number(),
  tierBreakpointsUsd: v.array(v.number()),
  pillsPerTier: v.array(v.number()),
  astrdsPerPill: v.array(v.number()),
}

// Public mutation — wallet address is validated against DEV_WALLETS.
// Not cryptographically secure (any Convex client can pass any address), but
// acceptable for a dev tool on devnet. HTTP endpoint is the secure path for prod.
export const setGameConfig = mutation({
  args: { walletAddress: v.string(), ...CONFIG_ARGS },
  handler: async (ctx, { walletAddress, ...args }) => {
    if (!DEV_WALLETS.has(walletAddress)) {
      throw new Error('Unauthorized')
    }
    const existing = await ctx.db.query('gameConfig').first()
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, version: existing.version + 1 })
    } else {
      await ctx.db.insert('gameConfig', { ...args, version: 1 })
    }
  },
})

// Internal version — used by the HTTP endpoint.
export const setGameConfigInternal = internalMutation({
  args: CONFIG_ARGS,
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('gameConfig').first()
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, version: existing.version + 1 })
    } else {
      await ctx.db.insert('gameConfig', { ...args, version: 1 })
    }
  },
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export const updateConfigHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const apiKey = process.env.ADMIN_API_KEY
  if (!apiKey) {
    return new Response('Admin API not configured', { status: 503, headers: CORS_HEADERS })
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${apiKey}`) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS })
  }

  const c = body as Record<string, unknown>

  const requiredNumbers = [
    'powerupSpawnDelayMs', 'shipPickupSpawnDelayMs', 'maxPowerupsOnScreen',
    'powerupDurationMs', 'maxLives', 'quarterUsd',
  ]
  for (const key of requiredNumbers) {
    if (typeof c[key] !== 'number' || isNaN(c[key] as number)) {
      return new Response(`Missing or invalid field: ${key}`, { status: 400, headers: CORS_HEADERS })
    }
  }

  const requiredArrays = ['tierBreakpointsUsd', 'pillsPerTier', 'astrdsPerPill']
  for (const key of requiredArrays) {
    if (!Array.isArray(c[key])) {
      return new Response(`Missing or invalid field: ${key}`, { status: 400, headers: CORS_HEADERS })
    }
  }

  await ctx.runMutation(internal.admin.setGameConfigInternal, {
    applyToRunning: Boolean(c.applyToRunning),
    powerupSpawnDelayMs: c.powerupSpawnDelayMs as number,
    shipPickupSpawnDelayMs: c.shipPickupSpawnDelayMs as number,
    maxPowerupsOnScreen: c.maxPowerupsOnScreen as number,
    powerupDurationMs: c.powerupDurationMs as number,
    maxLives: c.maxLives as number,
    quarterUsd: c.quarterUsd as number,
    tierBreakpointsUsd: c.tierBreakpointsUsd as number[],
    pillsPerTier: c.pillsPerTier as number[],
    astrdsPerPill: c.astrdsPerPill as number[],
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
