import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoOldFunctionSyntax } from "./convex-no-old-function-syntax.js";

describe("convex-no-old-function-syntax", () => {
  it("flags the legacy function shorthand on a query", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query(async (ctx) => {
        return ctx.db.query("messages").collect();
      });
    `;
    const result = runRule(convexNoOldFunctionSyntax, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags the legacy function shorthand on a mutation", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation(async (ctx, args) => {
        await ctx.db.insert("messages", { body: args.body });
      });
    `;
    const result = runRule(convexNoOldFunctionSyntax, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag the object syntax", () => {
    const code = `
      import { query } from "./_generated/server";
      import { v } from "convex/values";
      export const list = query({
        args: { channel: v.id("channels") },
        handler: async (ctx, args) => {
          return ctx.db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexNoOldFunctionSyntax, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag httpAction with a bare function", () => {
    const code = `
      import { httpAction } from "./_generated/server";
      export const postMessage = httpAction(async (ctx, request) => {
        return new Response(null, { status: 200 });
      });
    `;
    const result = runRule(convexNoOldFunctionSyntax, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named helper imported from a non-Convex module", () => {
    const code = `
      import { query } from "./my-query-library";
      export const list = query(async (ctx) => ctx.anything());
    `;
    const result = runRule(convexNoOldFunctionSyntax, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
