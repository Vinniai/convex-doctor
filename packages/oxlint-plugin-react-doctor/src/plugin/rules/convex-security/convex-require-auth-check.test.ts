import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexRequireAuthCheck } from "./convex-require-auth-check.js";

describe("convex-require-auth-check", () => {
  it("flags a public mutation that never checks auth", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const remove = mutation({
        args: { id: v.id("messages") },
        handler: async (ctx, args) => {
          await ctx.db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a public action that never checks auth", () => {
    const code = `
      import { action } from "./_generated/server";
      import { v } from "convex/values";
      export const charge = action({
        args: { amount: v.number() },
        handler: async (ctx, args) => {
          await ctx.runMutation(someRef, { amount: args.amount });
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a mutation that checks ctx.auth.getUserIdentity()", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const remove = mutation({
        args: { id: v.id("messages") },
        handler: async (ctx, args) => {
          const identity = await ctx.auth.getUserIdentity();
          if (!identity) throw new Error("Unauthenticated");
          await ctx.db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a handler that passes ctx to a helper", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      import { requireUser } from "./lib/auth";
      export const remove = mutation({
        args: { id: v.id("messages") },
        handler: async (ctx, args) => {
          await requireUser(ctx);
          await ctx.db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an internalMutation", () => {
    const code = `
      import { internalMutation } from "./_generated/server";
      import { v } from "convex/values";
      export const remove = internalMutation({
        args: { id: v.id("messages") },
        handler: async (ctx, args) => {
          await ctx.db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a public query without an auth check", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => ctx.db.query("messages").collect(),
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a handler that destructures auth from ctx", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const remove = mutation({
        args: { id: v.id("messages") },
        handler: async ({ auth, db }, args) => {
          const identity = await auth.getUserIdentity();
          if (!identity) throw new Error("Unauthenticated");
          await db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a homegrown mutation() helper from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const remove = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.commit(args);
        },
      });
    `;
    const result = runRule(convexRequireAuthCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
