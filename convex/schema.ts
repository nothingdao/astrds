import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  verifiedSessions: defineTable({
    walletAddress: v.string(),
    txSignature: v.string(),
    paymentType: v.union(v.literal('SOL'), v.literal('ASTRDS')),
    verifiedAt: v.number(),
    expiresAt: v.number(),
  }).index('by_wallet', ['walletAddress']),

  scores: defineTable({
    walletAddress: v.string(),
    score: v.number(),
    date: v.string(),
  }).index('by_score', ['score']),

  gameSessions: defineTable({
    walletAddress: v.string(),
    score: v.number(),
    levelReached: v.number(),
    sessionStart: v.string(),
    lastUpdated: v.string(),
    sessionEnd: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('ending'), v.literal('ended')),
  }).index('by_wallet', ['walletAddress']),

  chatMessages: defineTable({
    walletAddress: v.string(),
    message: v.string(),
    timestamp: v.string(),
  }),

  players: defineTable({
    walletAddress: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    updatedAt: v.number(),
  }).index('by_wallet', ['walletAddress']),

  spaceDeposits: defineTable({
    walletAddress: v.string(),       // depositor
    txSignature: v.string(),         // on-chain transfer tx
    mintAddress: v.string(),         // token mint
    programId: v.string(),           // 'TOKEN' or 'TOKEN_2022'
    symbol: v.string(),
    name: v.string(),
    logoUri: v.optional(v.string()),
    decimals: v.optional(v.number()),  // token decimals (optional for legacy docs)
    totalAmount: v.number(),         // total tokens deposited (raw units)
    remainingAmount: v.number(),     // tokens left to distribute (raw units)
    tokensPerPill: v.number(),       // raw units each collected pill represents
    minLevel: v.number(),
    maxLevel: v.number(),
    depositedAt: v.number(),
    status: v.union(v.literal('active'), v.literal('depleted'), v.literal('cancelled')),
  })
    .index('by_wallet', ['walletAddress'])
    .index('by_status', ['status']),
})
