// Dev-only mutations — no "use node", run in default Convex runtime.
// Seeds fake space deposits for UI testing without requiring on-chain txs.

import { mutation } from './_generated/server'
import { v } from 'convex/values'

const TEST_TOKENS = [
  { dir: 'cope',   symbol: 'COPE',   name: 'Copium' },
  { dir: 'ngmi',   symbol: 'NGMI',   name: 'Not Gonna Make It' },
  { dir: 'worm',   symbol: 'WORM',   name: 'Brain Worm' },
  { dir: 'rugd',   symbol: 'RUGD',   name: 'Rugged' },
  { dir: 'smol',   symbol: 'SMOL',   name: 'Smol Brain' },
  { dir: 'shill',  symbol: 'SHILL',  name: 'Shill Token' },
  { dir: 'rekt',   symbol: 'REKT',   name: 'Rekt Finance' },
  { dir: 'degen',  symbol: 'DEGEN',  name: 'Pure Degen' },
  { dir: 'pprhn',  symbol: 'PPRHN',  name: 'Paper Hands' },
  { dir: 'gbrain', symbol: 'GBRAIN', name: 'Gigabrain' },
]

const BASE_URL = 'https://astrds.ndao.computer'
const DECIMALS = 6
const TOKENS_PER_PILL = 100 * 10 ** DECIMALS   // 100 tokens per pill (raw)
const TOTAL_AMOUNT   = 10_000 * 10 ** DECIMALS  // 10k tokens per pool (raw)

// Fake but unique mint address derived from token dir so getTokenColor is stable
function fakeMint(dir: string): string {
  // 32-byte-ish base58 lookalike — deterministic from dir, unique per token
  const base = 'DEV1111111111111111111111111111'
  return base.slice(0, base.length - dir.length) + dir.toUpperCase().padEnd(dir.length, '1')
}

export const seedSpaceDeposits = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const now = Date.now()
    const inserted: string[] = []

    for (const token of TEST_TOKENS) {
      const mintAddress = fakeMint(token.dir)

      // Skip if an active deposit for this mint already exists
      const existing = await ctx.db
        .query('spaceDeposits')
        .withIndex('by_status', (q) => q.eq('status', 'active'))
        .collect()
      if (existing.some((d) => d.mintAddress === mintAddress)) continue

      await ctx.db.insert('spaceDeposits', {
        walletAddress,
        txSignature: `dev-seed-${token.dir}-${now}`,
        mintAddress,
        programId: 'TOKEN_2022',
        symbol: token.symbol,
        name: token.name,
        logoUri: `${BASE_URL}/tokens/${token.dir}/logo.svg`,
        decimals: DECIMALS,
        totalAmount: TOTAL_AMOUNT,
        remainingAmount: TOTAL_AMOUNT,
        tokensPerPill: TOKENS_PER_PILL,
        minLevel: 1,
        maxLevel: 99,
        depositedAt: now,
        status: 'active',
      })
      inserted.push(token.symbol)
    }

    return { inserted }
  },
})

export const clearDevDeposits = mutation({
  args: {},
  handler: async (ctx) => {
    const devDocs = await ctx.db
      .query('spaceDeposits')
      .collect()
    const devOnly = devDocs.filter((d) => d.txSignature.startsWith('dev-seed-'))
    for (const doc of devOnly) {
      await ctx.db.delete(doc._id)
    }
    return { deleted: devOnly.length }
  },
})
