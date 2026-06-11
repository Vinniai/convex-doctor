import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoUnnecessaryRunAction } from "./convex-no-unnecessary-run-action.js";

describe("convex-no-unnecessary-run-action", () => {
  it("flags ctx.runAction inside a plain (default-runtime) action", () => {
    const code = `
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const orchestrate = action({
        args: {},
        handler: async (ctx, args) => {
          return await ctx.runAction(internal.tasks.process, args);
        },
      });
    `;
    const result = runRule(convexNoUnnecessaryRunAction, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it('does NOT flag ctx.runAction in a "use node" file', () => {
    const code = `
      "use node";
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const orchestrate = action({
        args: {},
        handler: async (ctx, args) => {
          return await ctx.runAction(internal.tasks.process, args);
        },
      });
    `;
    const result = runRule(convexNoUnnecessaryRunAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag ctx.runAction inside a mutation (a different rule's territory)", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.runAction(internal.notifications.push, args);
        },
      });
    `;
    const result = runRule(convexNoUnnecessaryRunAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a plain helper call in an action", () => {
    const code = `
      import { action } from "./_generated/server";
      import { processTask } from "./model/tasks";
      export const orchestrate = action({
        args: {},
        handler: async (ctx, args) => {
          return await processTask(ctx, args);
        },
      });
    `;
    const result = runRule(convexNoUnnecessaryRunAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named action helper from a non-Convex module", () => {
    const code = `
      import { action } from "./my-state-library";
      export const orchestrate = action({
        handler: async (ctx, args) => {
          return await ctx.runAction("tasks.process", args);
        },
      });
    `;
    const result = runRule(convexNoUnnecessaryRunAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
