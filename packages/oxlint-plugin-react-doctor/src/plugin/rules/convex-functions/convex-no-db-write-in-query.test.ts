import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoDbWriteInQuery } from "./convex-no-db-write-in-query.js";

describe("convex-no-db-write-in-query", () => {
  it("flags ctx.db.insert inside a query handler", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          await ctx.db.insert("views", { at: 1 });
          return await ctx.db.query("messages").take(10);
        },
      });
    `;
    const result = runRule(convexNoDbWriteInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags patch, replace, and delete in internalQuery too", () => {
    const code = `
      import { internalQuery } from "./_generated/server";
      export const touch = internalQuery({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.patch("messages", args.id, { read: true });
          await ctx.db.replace("messages", args.id, { read: true });
          await ctx.db.delete("messages", args.id);
        },
      });
    `;
    const result = runRule(convexNoDbWriteInQuery, code);
    expect(result.diagnostics).toHaveLength(3);
  });

  it("flags a write through a destructured db parameter in a nested closure", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async ({ db }) => {
          const rows = await db.query("messages").take(10);
          return Promise.all(rows.map(async (row) => db.delete(row._id)));
        },
      });
    `;
    const result = runRule(convexNoDbWriteInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag writes in mutations or actions", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
          await ctx.db.patch("messages", args.id, { read: true });
        },
      });
    `;
    const result = runRule(convexNoDbWriteInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag read methods in a query", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx, args) => {
          const doc = await ctx.db.get("messages", args.id);
          return doc ?? (await ctx.db.query("messages").take(1));
        },
      });
    `;
    const result = runRule(convexNoDbWriteInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named query helper from a non-Convex module", () => {
    const code = `
      import { query } from "./my-orm";
      export const list = query({
        handler: async (ctx) => {
          await ctx.db.insert("messages", {});
        },
      });
    `;
    const result = runRule(convexNoDbWriteInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
