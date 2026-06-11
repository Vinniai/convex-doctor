import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// convex-no-unvalidated-args (no args) + convex-no-filter-in-query +
// convex-no-unbounded-collect inside the handler.
export const list = query({
  handler: async (ctx) => {
    return ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("channel"), "general"))
      .collect();
  },
});

// convex-require-auth-check + convex-no-untrusted-user-id +
// convex-prefer-convex-error + convex-no-floating-db-write.
export const send = mutation({
  args: { body: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    if (args.body.length === 0) {
      throw new Error("empty message");
    }
    ctx.db.insert("messages", { body: args.body, userId: args.userId, channel: "general" });
  },
});

// convex-no-ctx-db-in-action + convex-scheduler-internal-only +
// convex-no-api-self-call + convex-no-sequential-ctx-run.
export const digest = action({
  args: {},
  handler: async (ctx) => {
    const first = await ctx.runQuery(api.messages.list, {});
    const second = await ctx.runQuery(api.messages.list, {});
    await ctx.db.patch; // actions have no ctx.db
    await ctx.scheduler.runAfter(0, api.messages.send, {
      body: "digest ready",
      userId: "u1",
    });
    return [first, second];
  },
});

// convex-no-old-function-syntax (legacy shorthand).
export const latest = query(async (ctx) => {
  return ctx.db.query("messages").order("desc").take(10);
});
