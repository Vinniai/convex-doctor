import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoDateNowInQuery } from "./convex-no-date-now-in-query.js";

describe("convex-no-date-now-in-query", () => {
  it("flags Date.now() inside a query handler", () => {
    const code = `
      import { query } from "./_generated/server";
      export const recent = query({
        args: {},
        handler: async (ctx) => {
          const cutoff = Date.now() - 60_000;
          return ctx.db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexNoDateNowInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags Math.random() inside a query handler", () => {
    const code = `
      import { query } from "./_generated/server";
      export const sample = query({
        args: {},
        handler: async (ctx) => {
          const messages = await ctx.db.query("messages").collect();
          return messages[Math.floor(Math.random() * messages.length)];
        },
      });
    `;
    const result = runRule(convexNoDateNowInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags new Date() with no arguments inside a query handler", () => {
    const code = `
      import { query } from "./_generated/server";
      export const today = query({
        args: {},
        handler: async (ctx) => {
          const now = new Date();
          return now.toISOString();
        },
      });
    `;
    const result = runRule(convexNoDateNowInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag Date.now() inside a mutation handler", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body, sentAt: Date.now() });
        },
      });
    `;
    const result = runRule(convexNoDateNowInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag new Date(args.ts) with an argument", () => {
    const code = `
      import { query } from "./_generated/server";
      import { v } from "convex/values";
      export const since = query({
        args: { ts: v.number() },
        handler: async (ctx, args) => {
          const cutoff = new Date(args.ts);
          return cutoff.toISOString();
        },
      });
    `;
    const result = runRule(convexNoDateNowInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { query } from "./my-query-library";
      export const recent = query({
        handler: async (ctx) => Date.now(),
      });
    `;
    const result = runRule(convexNoDateNowInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
