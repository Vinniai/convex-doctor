import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoUntrustedUserId } from "./convex-no-untrusted-user-id.js";

describe("convex-no-untrusted-user-id", () => {
  it("flags a userId arg in a public mutation that never checks auth", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const updateProfile = mutation({
        args: { userId: v.id("users"), name: v.string() },
        handler: async (ctx, args) => {
          await ctx.db.patch(args.userId, { name: args.name });
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a snake_case user_id arg in a public query without auth", () => {
    const code = `
      import { query } from "./_generated/server";
      import { v } from "convex/values";
      export const getOrders = query({
        args: { user_id: v.id("users") },
        handler: async (ctx, args) => {
          return ctx.db
            .query("orders")
            .withIndex("by_user", (q) => q.eq("user_id", args.user_id))
            .collect();
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag when the handler checks ctx.auth", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const updateProfile = mutation({
        args: { userId: v.id("users"), name: v.string() },
        handler: async (ctx, args) => {
          const identity = await ctx.auth.getUserIdentity();
          if (!identity) throw new Error("Unauthenticated");
          await ctx.db.patch(args.userId, { name: args.name });
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an internal function with a userId arg", () => {
    const code = `
      import { internalMutation } from "./_generated/server";
      import { v } from "convex/values";
      export const updateProfile = internalMutation({
        args: { userId: v.id("users"), name: v.string() },
        handler: async (ctx, args) => {
          await ctx.db.patch(args.userId, { name: args.name });
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an arg named messageId", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const markRead = mutation({
        args: { messageId: v.id("messages") },
        handler: async (ctx, args) => {
          await ctx.db.patch(args.messageId, { read: true });
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a handler that passes ctx to an auth helper", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      import { requireAdmin } from "./lib/auth";
      export const updateProfile = mutation({
        args: { userId: v.id("users"), name: v.string() },
        handler: async (ctx, args) => {
          await requireAdmin(ctx);
          await ctx.db.patch(args.userId, { name: args.name });
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a homegrown mutation() helper from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const updateProfile = mutation({
        args: { userId: "string" },
        handler: async (ctx, args) => {
          await ctx.commit(args.userId);
        },
      });
    `;
    const result = runRule(convexNoUntrustedUserId, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
