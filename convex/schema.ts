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
})
