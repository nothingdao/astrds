import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { GAME_CONFIG_TABLE_FIELDS } from "./gameConfigValidators";

export default defineSchema({
  verifiedSessions: defineTable({
    walletAddress: v.string(),
    txSignature: v.string(),
    paymentType: v.union(v.literal("SOL"), v.literal("ASTRDS")),
    verifiedAt: v.number(),
    expiresAt: v.number(),
    consumed: v.optional(v.boolean()),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_tx", ["txSignature"]),

  scores: defineTable({
    walletAddress: v.string(),
    score: v.number(),
    date: v.string(),
  }).index("by_score", ["score"]),

  gameSessions: defineTable({
    walletAddress: v.string(),
    score: v.number(),
    levelReached: v.number(),
    pillsCollected: v.optional(v.number()),
    astrdsEarned: v.optional(v.number()), // authoritative ASTRDS to mint, written by game server at game over
    astrdsEarnedRaw: v.optional(v.string()), // raw 9-decimal units, supports fractional ASTRDS
    astrdsAllocated: v.optional(v.number()),
    astrdsBurned: v.optional(v.number()),
    sessionStart: v.string(),
    lastUpdated: v.string(),
    sessionEnd: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("ending"),
      v.literal("ended")
    ),
  }).index("by_wallet", ["walletAddress"]),

  chatMessages: defineTable({
    walletAddress: v.string(),
    message: v.string(),
    timestamp: v.string(),
  }),

  players: defineTable({
    walletAddress: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),

  spaceDeposits: defineTable({
    walletAddress: v.string(), // depositor
    txSignature: v.string(), // on-chain transfer tx
    poolAddress: v.optional(v.string()), // on-chain DepositPool PDA
    mintAddress: v.string(), // token mint
    programId: v.string(), // 'TOKEN' or 'TOKEN_2022'
    symbol: v.string(),
    name: v.string(),
    logoUri: v.optional(v.string()),
    decimals: v.optional(v.number()),
    totalAmount: v.number(), // verified on-chain amount (raw units)
    remainingAmount: v.number(), // tokens left to distribute (raw units)
    tokensPerPill: v.number(), // raw units each collected pill represents
    minLevel: v.number(),
    maxLevel: v.number(),
    depositedAt: v.number(),
    // Spawn distribution mode — controls how often tokens appear for each player
    // steady: fixed interval regardless of level
    // escalating: interval shrinks as level increases, rewarding skilled play
    // wave: burst of N tokens then a quiet cooldown period
    spawnMode: v.optional(
      v.union(v.literal("steady"), v.literal("escalating"), v.literal("wave"))
    ),
    spawnInterval: v.optional(v.number()), // seconds between spawns (base for all modes)
    escalationRate: v.optional(v.number()), // escalating only: rate interval shrinks per level
    waveSize: v.optional(v.number()), // wave only: tokens per burst
    waveCooldown: v.optional(v.number()), // wave only: quiet period between waves (seconds)
    status: v.union(
      v.literal("pending_verification"),
      v.literal("active"),
      v.literal("depleted"),
      v.literal("cancelled")
    ),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_wallet_mint", ["walletAddress", "mintAddress"])
    .index("by_status", ["status"])
    .index("by_tx", ["txSignature"]),

  // One-time server-issued spawn authorizations.
  // A ticket is issued when the server validates a spawn is allowed (session active,
  // cooldown elapsed). The client must present the ticket ID to collect the token.
  // This prevents bots from calling collectFromDeposit without actually playing.
  spawnTickets: defineTable({
    depositId: v.id("spaceDeposits"),
    playerWalletAddress: v.string(),
    gameSessionId: v.id("gameSessions"),
    issuedAt: v.number(),
    expiresAt: v.number(), // 60s TTL — uncollected ticket expires
    used: v.boolean(),
  })
    .index("by_wallet_deposit_time", [
      "playerWalletAddress",
      "depositId",
      "issuedAt",
    ])
    .index("by_game_session", ["gameSessionId"]),

  // Individual pill collection events, written server-side at collection time.
  // Persists across sessions — player can claim at any time from AccountScreen or
  // game-over screen. Status transitions: pending → claimed.
  collections: defineTable({
    playerWalletAddress: v.string(),
    depositId: v.id("spaceDeposits"),
    gameSessionId: v.id("gameSessions"),
    mintAddress: v.string(),
    amount: v.number(), // raw units owed to player
    spawnId: v.id("spawnTickets"), // the ticket that authorized this collection
    status: v.union(
      v.literal("pending"),
      v.literal("claiming"),
      v.literal("claimed")
    ),
    collectedAt: v.number(),
    claimedTxSignature: v.optional(v.string()),
  })
    .index("by_player_wallet", ["playerWalletAddress"])
    .index("by_status_wallet", ["status", "playerWalletAddress"])
    .index("by_game_session", ["gameSessionId"]),

  // On-chain claim transfer records — one per claimSpaceTokens execution (which
  // may cover many collection events). Used by webhook to distinguish authorized
  // game payouts from external treasury drains.
  claims: defineTable({
    depositId: v.id("spaceDeposits"),
    playerWalletAddress: v.string(),
    mintAddress: v.string(),
    txSignature: v.string(),
    amount: v.number(), // raw units transferred on-chain
    claimedAt: v.number(),
  })
    .index("by_signature", ["txSignature"])
    .index("by_deposit", ["depositId"])
    .index("by_player_wallet", ["playerWalletAddress"]),

  // Singleton — at most one document. Version increments on every write so the
  // game server can detect changes and optionally apply them to running sessions.
  gameConfig: defineTable(GAME_CONFIG_TABLE_FIELDS),

  economySnapshots: defineTable({
    timestamp: v.number(),
    source: v.union(v.literal("manual"), v.literal("crank"), v.literal("cron")),
    poolAddress: v.string(),
    solUsdPrice: v.number(),
    astrdsReserve: v.number(),
    solReserve: v.number(),
    priceSolPerAstrds: v.number(),
    priceUsdPerAstrds: v.number(),
    totalSupply: v.number(),
    pendingBuybackSol: v.number(),
    crankTxSignature: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),
});
