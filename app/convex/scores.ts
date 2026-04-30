import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getScores = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("scores")
      .withIndex("by_score")
      .order("desc")
      .take(10);
  },
});

export const submitScore = mutation({
  args: {
    walletAddress: v.string(),
    score: v.number(),
  },
  handler: async (ctx, { walletAddress, score }) => {
    await ctx.db.insert("scores", {
      walletAddress,
      score,
      date: new Date().toISOString(),
    });

    // Trim to top 10
    const all = await ctx.db
      .query("scores")
      .withIndex("by_score")
      .order("desc")
      .collect();

    if (all.length > 10) {
      await Promise.all(all.slice(10).map((s) => ctx.db.delete(s._id)));
    }

    return await ctx.db
      .query("scores")
      .withIndex("by_score")
      .order("desc")
      .take(10);
  },
});
