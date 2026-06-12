import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexExplicitTableIds } from "./convex-explicit-table-ids.js";

describe("convex-explicit-table-ids", () => {
  it("flags ctx.db.get without a table name", () => {
    const code = `
      import { query } from "./_generated/server";
      export const getMovie = query({
        args: {},
        handler: async (ctx, args) => {
          return await ctx.db.get(args.id);
        },
      });
    `;
    const result = runRule(convexExplicitTableIds, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags patch, replace, and delete without a table name", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const update = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.patch(args.id, { read: true });
          await ctx.db.replace(args.id, { read: true });
          await ctx.db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexExplicitTableIds, code);
    expect(result.diagnostics).toHaveLength(3);
  });

  it("flags a destructured db ctx parameter", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const remove = mutation({
        args: {},
        handler: async ({ db }, args) => {
          await db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexExplicitTableIds, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag calls that pass the table name first", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const update = mutation({
        args: {},
        handler: async (ctx, args) => {
          const movie = await ctx.db.get("movies", args.id);
          await ctx.db.patch("movies", args.id, { seen: true });
          await ctx.db.replace("movies", args.id, { seen: true });
          await ctx.db.delete("movies", args.id);
          return movie;
        },
      });
    `;
    const result = runRule(convexExplicitTableIds, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag insert or query chains", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("movies", { title: args.title });
          return await ctx.db.query("movies").take(5);
        },
      });
    `;
    const result = runRule(convexExplicitTableIds, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named helper outside a Convex handler", () => {
    const code = `
      import { db } from "./my-orm";
      export const load = async (id) => {
        return await db.get(id);
      };
    `;
    const result = runRule(convexExplicitTableIds, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
