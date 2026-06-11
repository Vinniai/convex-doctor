import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexRequireReturnsValidator } from "./convex-require-returns-validator.js";

describe("convex-require-returns-validator", () => {
  it("flags a public query without a returns validator", () => {
    const code = `
      import { query } from "./_generated/server";
      import { v } from "convex/values";
      export const list = query({
        args: { channel: v.id("channels") },
        handler: async (ctx, args) => {
          return ctx.db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexRequireReturnsValidator, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a public mutation without a returns validator", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexRequireReturnsValidator, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a function that declares returns", () => {
    const code = `
      import { query } from "./_generated/server";
      import { v } from "convex/values";
      export const count = query({
        args: {},
        returns: v.number(),
        handler: async (ctx) => {
          return (await ctx.db.query("messages").collect()).length;
        },
      });
    `;
    const result = runRule(convexRequireReturnsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag internal functions", () => {
    const code = `
      import { internalQuery } from "./_generated/server";
      export const get = internalQuery({
        args: {},
        handler: async (ctx) => ctx.db.query("messages").collect(),
      });
    `;
    const result = runRule(convexRequireReturnsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named helper imported from a non-Convex module", () => {
    const code = `
      import { query } from "./my-query-library";
      export const list = query({
        args: {},
        handler: async (ctx) => ctx.anything(),
      });
    `;
    const result = runRule(convexRequireReturnsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
