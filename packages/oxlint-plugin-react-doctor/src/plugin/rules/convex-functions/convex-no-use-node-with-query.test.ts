import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoUseNodeWithQuery } from "./convex-no-use-node-with-query.js";

describe("convex-no-use-node-with-query", () => {
  it('flags a query registered in a "use node" file', () => {
    const code = `
      "use node";
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => ctx.db.query("messages").collect(),
      });
    `;
    const result = runRule(convexNoUseNodeWithQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it('flags mutations and internal variants in a "use node" file', () => {
    const code = `
      "use node";
      import { internalMutation, mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
      export const prune = internalMutation({
        args: {},
        handler: async (ctx) => {},
      });
    `;
    const result = runRule(convexNoUseNodeWithQuery, code);
    expect(result.diagnostics).toHaveLength(2);
  });

  it('does NOT flag an action in a "use node" file', () => {
    const code = `
      "use node";
      import { action } from "./_generated/server";
      export const send = action({
        args: {},
        handler: async (ctx, args) => {
          await fetch("https://example.com");
        },
      });
    `;
    const result = runRule(convexNoUseNodeWithQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a query in a file without the directive", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => ctx.db.query("messages").collect(),
      });
    `;
    const result = runRule(convexNoUseNodeWithQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named helper imported from a non-Convex module", () => {
    const code = `
      "use node";
      import { query } from "./my-query-library";
      export const list = query({
        handler: async (ctx) => ctx.anything(),
      });
    `;
    const result = runRule(convexNoUseNodeWithQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
