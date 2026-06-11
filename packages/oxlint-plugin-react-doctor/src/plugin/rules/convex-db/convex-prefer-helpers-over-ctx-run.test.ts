import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPreferHelpersOverCtxRun } from "./convex-prefer-helpers-over-ctx-run.js";

describe("convex-prefer-helpers-over-ctx-run", () => {
  it("flags ctx.runQuery inside a mutation handler", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const update = mutation({
        args: {},
        handler: async (ctx, args) => {
          const user = await ctx.runQuery(internal.users.get, { id: args.id });
          await ctx.db.patch(user._id, { active: true });
        },
      });
    `;
    const result = runRule(convexPreferHelpersOverCtxRun, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags ctx.runMutation inside a query handler", () => {
    const code = `
      import { internalQuery } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const weird = internalQuery({
        args: {},
        handler: async (ctx, args) => {
          return await ctx.runMutation(internal.logs.add, { body: args.body });
        },
      });
    `;
    const result = runRule(convexPreferHelpersOverCtxRun, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag ctx.runQuery inside an action handler", () => {
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
    const result = runRule(convexPreferHelpersOverCtxRun, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a plain helper call", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { loadUser } from "./model/users";
      export const update = mutation({
        args: {},
        handler: async (ctx, args) => {
          const user = await loadUser(ctx, args.id);
          await ctx.db.patch(user._id, { active: true });
        },
      });
    `;
    const result = runRule(convexPreferHelpersOverCtxRun, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named mutation helper from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const update = mutation({
        handler: async (ctx, args) => {
          return await ctx.runQuery("users.get", { id: args.id });
        },
      });
    `;
    const result = runRule(convexPreferHelpersOverCtxRun, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
