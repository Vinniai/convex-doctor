import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoUnvalidatedArgs } from "./convex-no-unvalidated-args.js";

describe("convex-no-unvalidated-args", () => {
  it("flags a public mutation registered without args validators", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const send = mutation({
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a public query and action without args validators", () => {
    const code = `
      import { action, query } from "./_generated/server";
      export const list = query({
        handler: async (ctx) => ctx.db.query("messages").collect(),
      });
      export const notify = action({
        handler: async (ctx, args) => {
          await fetch(args.url);
        },
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(2);
  });

  it("does NOT flag a public function that declares args", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { v } from "convex/values";
      export const send = mutation({
        args: { body: v.string() },
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an internalMutation without args", () => {
    const code = `
      import { internalMutation } from "./_generated/server";
      export const cleanup = internalMutation({
        handler: async (ctx) => {
          await ctx.db.delete("logs");
        },
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an httpAction", () => {
    const code = `
      import { httpAction } from "./_generated/server";
      export const webhook = httpAction(async (ctx, request) => {
        return new Response("ok");
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag the legacy function shorthand (separate rule)", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query(async (ctx) => {
        return ctx.db.query("messages").collect();
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a homegrown mutation() helper from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const send = mutation({
        handler: async (ctx, args) => ctx.commit(args),
      });
    `;
    const result = runRule(convexNoUnvalidatedArgs, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
