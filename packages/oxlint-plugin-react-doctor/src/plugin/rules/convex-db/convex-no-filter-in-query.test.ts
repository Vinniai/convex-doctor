import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoFilterInQuery } from "./convex-no-filter-in-query.js";

describe("convex-no-filter-in-query", () => {
  it("flags .filter on a ctx.db.query chain", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          return await ctx.db
            .query("messages")
            .filter((q) => q.eq(q.field("channel"), "general"))
            .collect();
        },
      });
    `;
    const result = runRule(convexNoFilterInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags each .filter link in the chain", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const prune = mutation({
        args: {},
        handler: async (ctx) => {
          return await ctx.db
            .query("messages")
            .filter((q) => q.eq(q.field("channel"), "general"))
            .filter((q) => q.eq(q.field("read"), false))
            .collect();
        },
      });
    `;
    const result = runRule(convexNoFilterInQuery, code);
    expect(result.diagnostics).toHaveLength(2);
  });

  it("flags .filter with a destructured db ctx parameter", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async ({ db }) => {
          return await db.query("messages").filter((q) => q.eq(q.field("read"), false)).collect();
        },
      });
    `;
    const result = runRule(convexNoFilterInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag array .filter on a collected result", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          const page = await ctx.db.query("messages").take(10);
          return (await ctx.db.query("messages").take(10)).filter((m) => m.read);
        },
      });
    `;
    const result = runRule(convexNoFilterInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a withIndex-only chain", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          return await ctx.db
            .query("messages")
            .withIndex("by_channel", (q) => q.eq("channel", "general"))
            .collect();
        },
      });
    `;
    const result = runRule(convexNoFilterInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named query helper from a non-Convex module", () => {
    const code = `
      import { query } from "./my-orm";
      export const list = query({
        handler: async (ctx) => {
          return ctx.db.query("messages").filter((q) => q.eq("read", false)).collect();
        },
      });
    `;
    const result = runRule(convexNoFilterInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
