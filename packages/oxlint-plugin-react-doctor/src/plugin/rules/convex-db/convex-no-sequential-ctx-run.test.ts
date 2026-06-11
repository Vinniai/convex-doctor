import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoSequentialCtxRun } from "./convex-no-sequential-ctx-run.js";

describe("convex-no-sequential-ctx-run", () => {
  it("flags two awaited runQuery calls in an action — once", () => {
    const code = `
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const sync = action({
        args: {},
        handler: async (ctx, args) => {
          const user = await ctx.runQuery(internal.users.get, { id: args.id });
          const team = await ctx.runQuery(internal.teams.get, { id: user.teamId });
          return team;
        },
      });
    `;
    const result = runRule(convexNoSequentialCtxRun, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a runQuery followed by a runMutation", () => {
    const code = `
      import { internalAction } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const ingest = internalAction({
        args: {},
        handler: async (ctx, args) => {
          const existing = await ctx.runQuery(internal.docs.find, { key: args.key });
          await ctx.runMutation(internal.docs.upsert, { key: args.key, existing });
        },
      });
    `;
    const result = runRule(convexNoSequentialCtxRun, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a single awaited runQuery", () => {
    const code = `
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const fetchUser = action({
        args: {},
        handler: async (ctx, args) => {
          return await ctx.runQuery(internal.users.get, { id: args.id });
        },
      });
    `;
    const result = runRule(convexNoSequentialCtxRun, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag two calls in a mutation handler (a different rule's territory)", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const update = mutation({
        args: {},
        handler: async (ctx, args) => {
          const user = await ctx.runQuery(internal.users.get, { id: args.id });
          await ctx.runMutation(internal.users.touch, { id: user._id });
        },
      });
    `;
    const result = runRule(convexNoSequentialCtxRun, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named action helper from a non-Convex module", () => {
    const code = `
      import { action } from "./my-state-library";
      export const sync = action({
        handler: async (ctx) => {
          const a = await ctx.runQuery("a");
          const b = await ctx.runQuery("b");
          return [a, b];
        },
      });
    `;
    const result = runRule(convexNoSequentialCtxRun, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
