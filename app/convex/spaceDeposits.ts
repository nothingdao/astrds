// Queries, internal queries, and mutations for space deposits.
// No "use node" — these run in the default Convex runtime.

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import {
  SPAWN_TICKET_TTL_MS,
  canIssueSpawnTicket,
  canPoolSpawnOrCollect,
  canReserveCollection,
  canRevertClaimingCollection,
  canUseSpawnTicket,
  remainingAfterCollection,
  statusForRemaining,
  validateDepositAmounts,
  waveWindowStart,
} from "./spaceTokenLedger";

// ── Public queries ────────────────────────────────────────────────────────────

export const getEconomyStats = query({
  args: {},
  handler: async (ctx) => {
    const deposits = await ctx.db
      .query("spaceDeposits")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const allClaims = await ctx.db.query("claims").collect();
    const uniqueMints = new Set(deposits.map((d) => d.mintAddress)).size;
    const tokensInSpace = deposits.reduce(
      (sum, d) => sum + d.remainingAmount,
      0
    );
    const uniqueClaimers = new Set(allClaims.map((c) => c.playerWalletAddress))
      .size;
    const sessions = await ctx.db.query("gameSessions").collect();
    const totalAstrdsBurned = sessions.reduce(
      (sum, session) => sum + (session.astrdsBurned ?? 0),
      0
    );
    return {
      activePools: deposits.length,
      uniqueMints,
      tokensInSpace,
      totalClaims: allClaims.length,
      uniqueClaimers,
      totalAstrdsBurned,
    };
  },
});

export const getAllActiveSpaceDeposits = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("spaceDeposits")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getActivePoolsForLevel = query({
  args: { level: v.number() },
  handler: async (ctx, { level }) => {
    const all = await ctx.db
      .query("spaceDeposits")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return all.filter(
      (d) =>
        d.minLevel <= level &&
        d.maxLevel >= level &&
        d.remainingAmount >= d.tokensPerPill
    );
  },
});

export const getDepositById = query({
  args: { depositId: v.id("spaceDeposits") },
  handler: async (ctx, { depositId }) => {
    return ctx.db.get(depositId);
  },
});

// Returns all pending (unclaimed) collection events for a wallet, enriched
// with deposit display metadata. Used by SpaceTokenClaim and AccountScreen.
export const getPendingCollectionsByWallet = query({
  args: { playerWalletAddress: v.string() },
  handler: async (ctx, { playerWalletAddress }) => {
    const cols = await ctx.db
      .query("collections")
      .withIndex("by_status_wallet", (q) =>
        q.eq("status", "pending").eq("playerWalletAddress", playerWalletAddress)
      )
      .order("desc")
      .collect();

    return Promise.all(
      cols.map(async (col) => {
        const deposit = await ctx.db.get(col.depositId);
        return {
          ...col,
          depositWalletAddress: deposit?.walletAddress,
          poolAddress: deposit?.poolAddress,
          txSignature: deposit?.txSignature,
          programId: deposit?.programId,
          symbol: deposit?.symbol ?? "???",
          decimals: deposit?.decimals ?? 6,
          logoUri: deposit?.logoUri,
          name: deposit?.name ?? "???",
          tokensPerPill: deposit?.tokensPerPill ?? col.amount,
        };
      })
    );
  },
});

// On-chain claim history for AccountScreen (claimed transfers, not raw collections).
export const getDepositsByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    return ctx.db
      .query("spaceDeposits")
      .filter((q) => q.eq(q.field("walletAddress"), walletAddress))
      .collect();
  },
});

export const getClaimsByWallet = query({
  args: { playerWalletAddress: v.string() },
  handler: async (ctx, { playerWalletAddress }) => {
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_player_wallet", (q) =>
        q.eq("playerWalletAddress", playerWalletAddress)
      )
      .order("desc")
      .collect();

    return Promise.all(
      claims.map(async (claim) => {
        const deposit = await ctx.db.get(claim.depositId);
        return {
          ...claim,
          symbol: deposit?.symbol ?? "???",
          decimals: deposit?.decimals ?? 6,
          logoUri: deposit?.logoUri,
        };
      })
    );
  },
});

// ── Internal queries ──────────────────────────────────────────────────────────

export const getDeposit = internalQuery({
  args: { depositId: v.id("spaceDeposits") },
  handler: async (ctx, { depositId }) => {
    return ctx.db.get(depositId);
  },
});

export const getDepositBySignature = internalQuery({
  args: { txSignature: v.string() },
  handler: async (ctx, { txSignature }) => {
    return ctx.db
      .query("spaceDeposits")
      .withIndex("by_tx", (q) => q.eq("txSignature", txSignature))
      .first();
  },
});

export const getClaimBySignature = internalQuery({
  args: { txSignature: v.string() },
  handler: async (ctx, { txSignature }) => {
    return ctx.db
      .query("claims")
      .withIndex("by_signature", (q) => q.eq("txSignature", txSignature))
      .first();
  },
});

export const getAllActiveDeposits = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("spaceDeposits")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getDepositByMint = internalQuery({
  args: { mintAddress: v.string() },
  handler: async (ctx, { mintAddress }) => {
    const all = await ctx.db
      .query("spaceDeposits")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return all.find((d) => d.mintAddress === mintAddress) ?? null;
  },
});

export const getPendingCollectionsForClaim = internalQuery({
  args: { playerWalletAddress: v.string() },
  handler: async (ctx, { playerWalletAddress }) => {
    return ctx.db
      .query("collections")
      .withIndex("by_status_wallet", (q) =>
        q.eq("status", "pending").eq("playerWalletAddress", playerWalletAddress)
      )
      .collect();
  },
});

// ── Public mutations ──────────────────────────────────────────────────────────

// Step 1 of deposit flow: register intent before sending tx.
export const registerDepositIntent = mutation({
  args: {
    walletAddress: v.string(),
    mintAddress: v.string(),
    programId: v.string(),
    symbol: v.string(),
    name: v.string(),
    logoUri: v.optional(v.string()),
    decimals: v.number(),
    tokensPerPill: v.number(),
    minLevel: v.number(),
    maxLevel: v.number(),
    spawnMode: v.optional(
      v.union(v.literal("steady"), v.literal("escalating"), v.literal("wave"))
    ),
    spawnInterval: v.optional(v.number()),
    escalationRate: v.optional(v.number()),
    waveSize: v.optional(v.number()),
    waveCooldown: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("spaceDeposits")
      .withIndex("by_wallet_mint", (q) =>
        q
          .eq("walletAddress", args.walletAddress)
          .eq("mintAddress", args.mintAddress)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return ctx.db.insert("spaceDeposits", {
      ...args,
      txSignature: "",
      poolAddress: undefined,
      totalAmount: 0,
      remainingAmount: 0,
      depositedAt: Date.now(),
      status: "pending_verification",
    });
  },
});

// Step 2: mirror the on-chain pool state after the deposit transaction confirms.
export const confirmDepositFromChain = mutation({
  args: {
    depositId: v.id("spaceDeposits"),
    txSignature: v.string(),
    poolAddress: v.string(),
    walletAddress: v.string(),
    mintAddress: v.string(),
    programId: v.string(),
    symbol: v.string(),
    name: v.string(),
    logoUri: v.optional(v.string()),
    decimals: v.number(),
    totalAmount: v.number(),
    remainingAmount: v.number(),
    tokensPerPill: v.number(),
    minLevel: v.number(),
    maxLevel: v.number(),
    spawnMode: v.optional(
      v.union(v.literal("steady"), v.literal("escalating"), v.literal("wave"))
    ),
    spawnInterval: v.optional(v.number()),
    escalationRate: v.optional(v.number()),
    waveSize: v.optional(v.number()),
    waveCooldown: v.optional(v.number()),
    depositedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { depositId, remainingAmount, tokensPerPill, ...fields } = args;
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");

    // Only the depositor can confirm their own deposit.
    if (deposit.walletAddress !== args.walletAddress) {
      throw new Error("Unauthorized: deposit belongs to a different wallet");
    }

    // Sanity-check amounts — can't claim more than deposited or negative values.
    validateDepositAmounts({
      totalAmount: args.totalAmount,
      remainingAmount,
      tokensPerPill,
    });

    await ctx.db.patch(depositId, {
      ...fields,
      remainingAmount,
      tokensPerPill,
      status: statusForRemaining(remainingAmount, tokensPerPill),
    });
  },
});

// ── requestSpawnTicket ────────────────────────────────────────────────────────
// Called by the game engine when it wants to spawn a space token.
// Validates the player has an active paid session, checks the per-player
// spawn cooldown for this pool's mode, and issues a one-time ticket ID.
// The engine spawns the Token entity only if a ticket is returned.
export const requestSpawnTicket = mutation({
  args: {
    depositId: v.id("spaceDeposits"),
    playerWalletAddress: v.string(),
    gameSessionId: v.id("gameSessions"),
  },
  handler: async (ctx, { depositId, playerWalletAddress, gameSessionId }) => {
    // Validate game session: must be active and belong to this wallet.
    const session = await ctx.db.get(gameSessionId);
    if (!session || session.status !== "active") return { spawnId: null };
    if (session.walletAddress !== playerWalletAddress) return { spawnId: null };

    // Validate verified session: player must have paid to play.
    const verifiedSession = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", playerWalletAddress))
      .order("desc")
      .first();
    if (!verifiedSession || verifiedSession.expiresAt < Date.now())
      return { spawnId: null };

    // Validate pool: must have tokens left to give.
    const deposit = await ctx.db.get(depositId);
    if (!canPoolSpawnOrCollect(deposit)) return { spawnId: null };

    const now = Date.now();
    const last = await ctx.db
      .query("spawnTickets")
      .withIndex("by_wallet_deposit_time", (q) =>
        q
          .eq("playerWalletAddress", playerWalletAddress)
          .eq("depositId", depositId)
      )
      .order("desc")
      .first();
    let ticketsInWindow = 0;
    if ((deposit.spawnMode ?? "steady") === "wave") {
      ticketsInWindow = (
        await ctx.db
          .query("spawnTickets")
          .withIndex("by_wallet_deposit_time", (q) =>
            q
              .eq("playerWalletAddress", playerWalletAddress)
              .eq("depositId", depositId)
              .gte("issuedAt", waveWindowStart(now, deposit))
          )
          .collect()
      ).length;
    }

    if (
      !canIssueSpawnTicket({
        policy: deposit,
        now,
        level: session.levelReached ?? 1,
        lastIssuedAt: last?.issuedAt,
        ticketsInWindow,
      })
    ) {
      return { spawnId: null };
    }

    const spawnId = await ctx.db.insert("spawnTickets", {
      depositId,
      playerWalletAddress,
      gameSessionId,
      issuedAt: now,
      expiresAt: now + SPAWN_TICKET_TTL_MS,
      used: false,
    });

    return { spawnId };
  },
});

// ── collectFromDeposit ────────────────────────────────────────────────────────
// Called on ship-token collision. Validates the server-issued spawn ticket,
// atomically decrements the pool, and writes a persistent collection record.
// The collection record survives browser close — player claims whenever they want.
export const collectFromDeposit = mutation({
  args: {
    spawnId: v.id("spawnTickets"),
    playerWalletAddress: v.string(),
    gameSessionId: v.id("gameSessions"),
  },
  handler: async (ctx, { spawnId, playerWalletAddress, gameSessionId }) => {
    // Validate ticket: must be unused, not expired, and belong to this player+session.
    const ticket = await ctx.db.get(spawnId);
    if (
      !canUseSpawnTicket(ticket, {
        playerWalletAddress,
        gameSessionId,
        now: Date.now(),
      })
    ) {
      return { success: false };
    }

    // Mark ticket used immediately — prevents any race on double-collect.
    await ctx.db.patch(spawnId, { used: true });

    // Decrement pool.
    const deposit = await ctx.db.get(ticket.depositId);
    if (!canPoolSpawnOrCollect(deposit)) return { success: false };

    const nextPoolState = remainingAfterCollection(deposit);
    await ctx.db.patch(ticket.depositId, nextPoolState);

    // Write persistent collection record — survives browser close.
    await ctx.db.insert("collections", {
      playerWalletAddress,
      depositId: ticket.depositId,
      gameSessionId,
      mintAddress: deposit.mintAddress,
      amount: deposit.tokensPerPill,
      spawnId,
      status: "pending",
      collectedAt: Date.now(),
    });

    return { success: true, amount: deposit.tokensPerPill };
  },
});

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
    decimals: v.optional(v.number()),
    totalAmount: v.number(),
    tokensPerPill: v.number(),
    minLevel: v.number(),
    maxLevel: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("spaceDeposits", {
      ...args,
      remainingAmount: args.totalAmount,
      depositedAt: Date.now(),
      status: "active",
    });
  },
});

export const confirmDeposit = internalMutation({
  args: {
    depositId: v.id("spaceDeposits"),
    totalAmount: v.number(),
    depositedAt: v.number(),
  },
  handler: async (ctx, { depositId, totalAmount, depositedAt }) => {
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status === "active") return;
    await ctx.db.patch(depositId, {
      totalAmount,
      remainingAmount: totalAmount,
      depositedAt,
      status: statusForRemaining(totalAmount, deposit.tokensPerPill),
    });
  },
});

export const insertDepositFromWebhook = internalMutation({
  args: {
    txSignature: v.string(),
    mintAddress: v.string(),
    totalAmount: v.number(),
    depositedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("spaceDeposits")
      .withIndex("by_tx", (q) => q.eq("txSignature", args.txSignature))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("spaceDeposits", {
      walletAddress: "unknown",
      txSignature: args.txSignature,
      mintAddress: args.mintAddress,
      programId: "TOKEN_2022",
      symbol: "???",
      name: "Unknown (webhook)",
      decimals: 6,
      totalAmount: args.totalAmount,
      remainingAmount: args.totalAmount,
      tokensPerPill: args.totalAmount,
      minLevel: 1,
      maxLevel: 99,
      depositedAt: args.depositedAt,
      status: "active",
    });
  },
});

export const reconcilePoolBalance = internalMutation({
  args: {
    depositId: v.id("spaceDeposits"),
    onChainBalance: v.number(),
  },
  handler: async (ctx, { depositId, onChainBalance }) => {
    const deposit = await ctx.db.get(depositId);
    if (!deposit) return;
    if (deposit.remainingAmount <= onChainBalance) return;
    await ctx.db.patch(depositId, {
      remainingAmount: onChainBalance,
      status: statusForRemaining(onChainBalance, deposit.tokensPerPill),
    });
  },
});

export const recordClaim = internalMutation({
  args: {
    depositId: v.id("spaceDeposits"),
    playerWalletAddress: v.string(),
    mintAddress: v.string(),
    txSignature: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("claims", {
      ...args,
      claimedAt: Date.now(),
    });
  },
});

// Marks a batch of collection records as claimed after the on-chain transfer succeeds.
export const markCollectionClaiming = internalMutation({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const col = await ctx.db.get(id);
    if (!col || !canReserveCollection(col.status)) return false;
    await ctx.db.patch(id, { status: "claiming" });
    return true;
  },
});

export const revertClaimingCollections = mutation({
  args: {
    collectionIds: v.array(v.id("collections")),
    playerWalletAddress: v.string(),
  },
  handler: async (ctx, { collectionIds, playerWalletAddress }) => {
    for (const id of collectionIds) {
      const col = await ctx.db.get(id);
      if (!col || col.playerWalletAddress !== playerWalletAddress) continue;
      if (canRevertClaimingCollection(col.status))
        await ctx.db.patch(id, { status: "pending" });
    }
  },
});

export const markCollectionsClaimed = internalMutation({
  args: {
    collectionIds: v.array(v.id("collections")),
    claimedTxSignature: v.optional(v.string()),
  },
  handler: async (ctx, { collectionIds, claimedTxSignature }) => {
    for (const id of collectionIds) {
      await ctx.db.patch(id, { status: "claimed", claimedTxSignature });
    }
  },
});

export const finalizeClaim = mutation({
  args: {
    depositId: v.id("spaceDeposits"),
    collectionIds: v.array(v.id("collections")),
    playerWalletAddress: v.string(),
    mintAddress: v.string(),
    txSignature: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify every collection belongs to the calling player before touching anything.
    for (const id of args.collectionIds) {
      const col = await ctx.db.get(id);
      if (!col || col.playerWalletAddress !== args.playerWalletAddress) {
        throw new Error(
          "Unauthorized: collection does not belong to this player"
        );
      }
    }

    await ctx.db.insert("claims", {
      depositId: args.depositId,
      playerWalletAddress: args.playerWalletAddress,
      mintAddress: args.mintAddress,
      txSignature: args.txSignature,
      amount: args.amount,
      claimedAt: Date.now(),
    });

    for (const id of args.collectionIds) {
      await ctx.db.patch(id, {
        status: "claimed",
        claimedTxSignature: args.txSignature,
      });
    }
  },
});

export const getAllDeposits = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("spaceDeposits").collect(),
});

export const getDepositByWalletAndMint = internalQuery({
  args: { walletAddress: v.string(), mintAddress: v.string() },
  handler: async (ctx, { walletAddress, mintAddress }) =>
    ctx.db
      .query("spaceDeposits")
      .withIndex("by_wallet_mint", (q) =>
        q.eq("walletAddress", walletAddress).eq("mintAddress", mintAddress)
      )
      .first(),
});

export const upsertRecoveredDeposit = internalMutation({
  args: {
    poolAddress: v.string(),
    walletAddress: v.string(),
    mintAddress: v.string(),
    programId: v.string(),
    symbol: v.string(),
    name: v.string(),
    logoUri: v.optional(v.string()),
    decimals: v.number(),
    totalAmount: v.number(),
    remainingAmount: v.number(),
    tokensPerPill: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("spaceDeposits")
      .withIndex("by_wallet_mint", (q) =>
        q
          .eq("walletAddress", args.walletAddress)
          .eq("mintAddress", args.mintAddress)
      )
      .first();

    const status = statusForRemaining(args.remainingAmount, args.tokensPerPill);

    if (existing) {
      await ctx.db.patch(existing._id, {
        poolAddress: args.poolAddress,
        remainingAmount: args.remainingAmount,
        totalAmount: args.totalAmount,
        symbol: args.symbol,
        name: args.name,
        logoUri: args.logoUri,
        decimals: args.decimals,
        status,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("spaceDeposits", {
      ...args,
      txSignature: `recovered-${args.poolAddress.slice(0, 8)}`,
      minLevel: 1,
      maxLevel: 10,
      spawnMode: "steady",
      spawnInterval: 30,
      depositedAt: Date.now(),
      status,
    });
    return { id, created: true };
  },
});

export const decrementDeposit = internalMutation({
  args: {
    depositId: v.id("spaceDeposits"),
    amount: v.number(),
  },
  handler: async (ctx, { depositId, amount }) => {
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    const newRemaining = Math.max(0, deposit.remainingAmount - amount);
    await ctx.db.patch(depositId, {
      remainingAmount: newRemaining,
      status: statusForRemaining(newRemaining, deposit.tokensPerPill),
    });
  },
});
