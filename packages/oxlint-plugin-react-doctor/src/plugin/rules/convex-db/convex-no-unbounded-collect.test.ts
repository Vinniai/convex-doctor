import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoUnboundedCollect } from "./convex-no-unbounded-collect.js";

describe("convex-no-unbounded-collect", () => {
  it("flags a bare ctx.db.query(...).collect()", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          return await ctx.db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexNoUnboundedCollect, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags .order('desc').collect() — ordering does not bound the scan", () => {
    const code = `
      import { query } from "./_generated/server";
      export const latest = query({
        args: {},
        handler: async (ctx) => {
          return await ctx.db.query("messages").order("desc").collect();
        },
      });
    `;
    const result = runRule(convexNoUnboundedCollect, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag .withIndex(...).collect()", () => {
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
    const result = runRule(convexNoUnboundedCollect, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag .withSearchIndex(...).collect()", () => {
    const code = `
      import { query } from "./_generated/server";
      export const search = query({
        args: {},
        handler: async (ctx) => {
          return await ctx.db
            .query("messages")
            .withSearchIndex("search_body", (q) => q.search("body", "hello"))
            .collect();
        },
      });
    `;
    const result = runRule(convexNoUnboundedCollect, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a .take(10) bounded read", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          return await ctx.db.query("messages").take(10);
        },
      });
    `;
    const result = runRule(convexNoUnboundedCollect, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named query helper from a non-Convex module", () => {
    const code = `
      import { query } from "./my-orm";
      export const list = query({
        handler: async (ctx) => {
          return ctx.db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexNoUnboundedCollect, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
