import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexSchedulerInternalOnly } from "./convex-scheduler-internal-only.js";

describe("convex-scheduler-internal-only", () => {
  it("flags ctx.scheduler.runAfter targeting an api.* function", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { api } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.scheduler.runAfter(0, api.messages.destruct, { id: args.id });
        },
      });
    `;
    const result = runRule(convexSchedulerInternalOnly, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags ctx.scheduler.runAt targeting an api.* function", () => {
    const code = `
      import { action } from "./_generated/server";
      import { api } from "./_generated/api";
      export const remind = action({
        args: {},
        handler: async (ctx, args) => {
          await ctx.scheduler.runAt(args.timestamp, api.reminders.fire, {});
        },
      });
    `;
    const result = runRule(convexSchedulerInternalOnly, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a destructured scheduler targeting an api.* function", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { api } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async ({ scheduler }) => {
          await scheduler.runAfter(1000, api.messages.send, {});
        },
      });
    `;
    const result = runRule(convexSchedulerInternalOnly, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag scheduling internal.* functions", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.scheduler.runAfter(0, internal.messages.destruct, { id: args.id });
          await ctx.scheduler.runAt(args.at, internal.reminders.fire, {});
        },
      });
    `;
    const result = runRule(convexSchedulerInternalOnly, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a scheduler call outside a Convex handler", () => {
    const code = `
      import { api } from "./_generated/api";
      const ctx = getSomeContext();
      ctx.scheduler.runAfter(0, api.messages.destruct, {});
    `;
    const result = runRule(convexSchedulerInternalOnly, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a homegrown mutation() helper from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      import { api } from "./_generated/api";
      export const send = mutation({
        handler: async (ctx) => {
          await ctx.scheduler.runAfter(0, api.messages.destruct, {});
        },
      });
    `;
    const result = runRule(convexSchedulerInternalOnly, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
