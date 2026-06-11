import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoFloatingScheduler } from "./convex-no-floating-scheduler.js";

describe("convex-no-floating-scheduler", () => {
  it("flags a bare ctx.scheduler.runAfter statement", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          ctx.scheduler.runAfter(0, internal.messages.deliver, { id: args.id });
        },
      });
    `;
    const result = runRule(convexNoFloatingScheduler, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a bare ctx.scheduler.runAt statement", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          ctx.scheduler.runAt(args.timestamp, internal.messages.deliver, {});
        },
      });
    `;
    const result = runRule(convexNoFloatingScheduler, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag an awaited scheduler call", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.scheduler.runAfter(0, internal.messages.deliver, { id: args.id });
        },
      });
    `;
    const result = runRule(convexNoFloatingScheduler, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a void-ed scheduler call", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          void ctx.scheduler.runAfter(0, internal.messages.deliver, { id: args.id });
        },
      });
    `;
    const result = runRule(convexNoFloatingScheduler, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a scheduler call assigned to a variable", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = mutation({
        args: {},
        handler: async (ctx, args) => {
          const jobId = ctx.scheduler.runAfter(0, internal.messages.deliver, {});
          return jobId;
        },
      });
    `;
    const result = runRule(convexNoFloatingScheduler, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const send = mutation({
        handler: async (ctx) => {
          ctx.scheduler.runAfter(0, "anything");
        },
      });
    `;
    const result = runRule(convexNoFloatingScheduler, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
