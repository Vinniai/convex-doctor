import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexAnnotateHelperCtx } from "./convex-annotate-helper-ctx.js";

const CONVEX_FILE = { filename: "/proj/convex/messages.ts" };

describe("convex-annotate-helper-ctx", () => {
  it("flags a module-level function declaration with an unannotated ctx", () => {
    const code = `
      async function getUser(ctx, id) {
        return ctx.db.get(id);
      }
    `;
    const result = runRule(convexAnnotateHelperCtx, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a helper whose ctx is annotated with QueryCtx", () => {
    const code = `
      import type { QueryCtx } from "./_generated/server";
      export const getUser = (ctx: QueryCtx) => ctx.auth.getUserIdentity();
    `;
    const result = runRule(convexAnnotateHelperCtx, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("flags a ctx annotated as any", () => {
    const code = `
      export const getUser = async (ctx: any) => {
        return ctx.db.get("id");
      };
    `;
    const result = runRule(convexAnnotateHelperCtx, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a registrar handler (contextually typed)", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexAnnotateHelperCtx, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag the legacy registrar function shorthand", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query(async (ctx) => ctx.db.query("messages").collect());
    `;
    const result = runRule(convexAnnotateHelperCtx, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag the same code outside a convex directory", () => {
    const code = `
      async function getUser(ctx, id) {
        return ctx.db.get(id);
      }
    `;
    const result = runRule(convexAnnotateHelperCtx, code, {
      filename: "/proj/src/helpers.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the host provides no filename", () => {
    const code = `
      async function getUser(ctx, id) {
        return ctx.db.get(id);
      }
    `;
    const result = runRule(convexAnnotateHelperCtx, code, { filename: undefined });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag helpers whose first parameter is not named ctx", () => {
    const code = `
      export const formatBody = (body, suffix) => body + suffix;
    `;
    const result = runRule(convexAnnotateHelperCtx, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });
});
