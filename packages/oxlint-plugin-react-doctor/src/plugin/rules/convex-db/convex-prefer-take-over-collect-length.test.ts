import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPreferTakeOverCollectLength } from "./convex-prefer-take-over-collect-length.js";

describe("convex-prefer-take-over-collect-length", () => {
  it("flags (await ctx.db.query(...).collect()).length", () => {
    const code = `
      import { query } from "./_generated/server";
      export const count = query({
        args: {},
        handler: async (ctx) => {
          return (await ctx.db.query("messages").collect()).length;
        },
      });
    `;
    const result = runRule(convexPreferTakeOverCollectLength, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags counting an indexed collect too", () => {
    const code = `
      import { query } from "./_generated/server";
      export const count = query({
        args: {},
        handler: async (ctx) => {
          const total = (
            await ctx.db
              .query("messages")
              .withIndex("by_channel", (q) => q.eq("channel", "general"))
              .collect()
          ).length;
          return total;
        },
      });
    `;
    const result = runRule(convexPreferTakeOverCollectLength, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag using the collected documents for content", () => {
    const code = `
      import { query } from "./_generated/server";
      export const bodies = query({
        args: {},
        handler: async (ctx) => {
          const docs = await ctx.db.query("messages").collect();
          return docs.map((doc) => doc.body);
        },
      });
    `;
    const result = runRule(convexPreferTakeOverCollectLength, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag .length on an ordinary array", () => {
    const code = `
      import { query } from "./_generated/server";
      export const count = query({
        args: {},
        handler: async (ctx, args) => {
          return args.ids.length;
        },
      });
    `;
    const result = runRule(convexPreferTakeOverCollectLength, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named query helper from a non-Convex module", () => {
    const code = `
      import { query } from "./my-orm";
      export const count = query({
        handler: async (ctx) => {
          return (await ctx.db.query("messages").collect()).length;
        },
      });
    `;
    const result = runRule(convexPreferTakeOverCollectLength, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
