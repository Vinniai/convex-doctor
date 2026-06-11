import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoTimersInQuery } from "./convex-no-timers-in-query.js";

describe("convex-no-timers-in-query", () => {
  it("flags setTimeout inside a mutation handler", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          setTimeout(() => {
            console.log("too late");
          }, 1000);
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoTimersInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags setInterval inside a query handler", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          setInterval(() => {}, 1000);
          return ctx.db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexNoTimersInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag setTimeout inside an action handler", () => {
    const code = `
      import { action } from "./_generated/server";
      export const poll = action({
        args: {},
        handler: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        },
      });
    `;
    const result = runRule(convexNoTimersInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a locally imported setTimeout helper", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { setTimeout } from "./my-scheduler";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          setTimeout(args.id);
        },
      });
    `;
    const result = runRule(convexNoTimersInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const add = mutation({
        handler: async (ctx) => {
          setTimeout(() => {}, 1000);
        },
      });
    `;
    const result = runRule(convexNoTimersInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
