import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexAvoidDbInLoop } from "./convex-avoid-db-in-loop.js";

describe("convex-avoid-db-in-loop", () => {
  it("flags an awaited ctx.db.get inside a for-of loop", () => {
    const code = `
      import { query } from "./_generated/server";
      export const hydrate = query({
        args: {},
        handler: async (ctx, args) => {
          const users = [];
          for (const id of args.ids) {
            users.push(await ctx.db.get(id));
          }
          return users;
        },
      });
    `;
    const result = runRule(convexAvoidDbInLoop, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags only once per loop even with multiple awaited db calls", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const sync = mutation({
        args: {},
        handler: async (ctx, args) => {
          for (const item of args.items) {
            const existing = await ctx.db.get(item.id);
            await ctx.db.patch(item.id, { count: existing.count + 1 });
          }
        },
      });
    `;
    const result = runRule(convexAvoidDbInLoop, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a while loop awaiting a db query chain", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const drain = mutation({
        args: {},
        handler: async (ctx) => {
          let batch = [];
          while (true) {
            batch = await ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", "queued")).take(10);
            if (batch.length === 0) break;
          }
        },
      });
    `;
    const result = runRule(convexAvoidDbInLoop, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a batched Promise.all over a map", () => {
    const code = `
      import { query } from "./_generated/server";
      export const hydrate = query({
        args: {},
        handler: async (ctx, args) => {
          return await Promise.all(args.ids.map((id) => ctx.db.get(id)));
        },
      });
    `;
    const result = runRule(convexAvoidDbInLoop, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a loop without db calls", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const tally = mutation({
        args: {},
        handler: async (ctx, args) => {
          let total = 0;
          for (const item of args.items) {
            total += item.amount;
          }
          await ctx.db.insert("totals", { total });
        },
      });
    `;
    const result = runRule(convexAvoidDbInLoop, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named query helper from a non-Convex module", () => {
    const code = `
      import { query } from "./my-orm";
      export const hydrate = query({
        handler: async (ctx, args) => {
          for (const id of args.ids) {
            await ctx.db.get(id);
          }
        },
      });
    `;
    const result = runRule(convexAvoidDbInLoop, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
