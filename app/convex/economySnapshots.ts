import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    // Avoid spammy duplicate manual samples when the Economy tab refreshes several
    // times in quick succession. Crank samples are always recorded because they
    // mark explicit economic events.
    if (args.source !== "crank") {
      const recent = await ctx.db
        .query("economySnapshots")
        .withIndex("by_timestamp")
        .order("desc")
        .first();
      if (recent && timestamp - recent.timestamp < 60_000) {
        return recent._id;
      }
    }

    return await ctx.db.insert("economySnapshots", {
      ...args,
      timestamp,
    });
  },
});

export const latest = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 96, 1), 500);
    const rows = await ctx.db
      .query("economySnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    return rows.reverse();
  },
});
