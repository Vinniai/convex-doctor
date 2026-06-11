import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoRunActionFromMutation } from "./convex-no-run-action-from-mutation.js";

describe("convex-no-run-action-from-mutation", () => {
  it("flags ctx.runAction inside a mutation handler", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
          await ctx.runAction(internal.notifications.push, { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoRunActionFromMutation, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags ctx.runAction inside an internalMutation handler", () => {
    const code = `
      import { internalMutation } from "../_generated/server";
      import { internal } from "../_generated/api";
      export const sync = internalMutation({
        args: {},
        handler: async (ctx) => {
          return await ctx.runAction(internal.external.sync, {});
        },
      });
    `;
    const result = runRule(convexNoRunActionFromMutation, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag ctx.runAction inside an action handler", () => {
    const code = `
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const orchestrate = action({
        args: {},
        handler: async (ctx, args) => {
          return await ctx.runAction(internal.node.heavyLifting, args);
        },
      });
    `;
    const result = runRule(convexNoRunActionFromMutation, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag scheduling an action from a mutation", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.scheduler.runAfter(0, internal.notifications.push, { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoRunActionFromMutation, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named mutation helper from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const send = mutation({
        handler: async (ctx, args) => {
          await ctx.runAction("notifications.push", args);
        },
      });
    `;
    const result = runRule(convexNoRunActionFromMutation, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
