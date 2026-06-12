import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoMultiplePaginate } from "./convex-no-multiple-paginate.js";

describe("convex-no-multiple-paginate", () => {
  it("flags a second .paginate call in the same query", () => {
    const code = `
      import { query } from "./_generated/server";
      import { paginationOptsValidator } from "convex/server";
      export const list = query({
        args: { paginationOpts: paginationOptsValidator },
        handler: async (ctx, args) => {
          const messages = await ctx.db.query("messages").paginate(args.paginationOpts);
          const threads = await ctx.db.query("threads").paginate(args.paginationOpts);
          return { messages, threads };
        },
      });
    `;
    const result = runRule(convexNoMultiplePaginate, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a single .paginate call", () => {
    const code = `
      import { query } from "./_generated/server";
      import { paginationOptsValidator } from "convex/server";
      export const list = query({
        args: { paginationOpts: paginationOptsValidator },
        handler: async (ctx, args) => {
          return await ctx.db.query("messages").paginate(args.paginationOpts);
        },
      });
    `;
    const result = runRule(convexNoMultiplePaginate, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag one .paginate call in each of two functions", () => {
    const code = `
      import { query } from "./_generated/server";
      import { paginationOptsValidator } from "convex/server";
      export const listMessages = query({
        args: { paginationOpts: paginationOptsValidator },
        handler: async (ctx, args) => {
          return await ctx.db.query("messages").paginate(args.paginationOpts);
        },
      });
      export const listThreads = query({
        args: { paginationOpts: paginationOptsValidator },
        handler: async (ctx, args) => {
          return await ctx.db.query("threads").paginate(args.paginationOpts);
        },
      });
    `;
    const result = runRule(convexNoMultiplePaginate, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT count .paginate on a non-db object toward the limit", () => {
    const code = `
      import { query } from "./_generated/server";
      import { paginationOptsValidator } from "convex/server";
      import { customPager } from "./pager";
      export const list = query({
        args: { paginationOpts: paginationOptsValidator },
        handler: async (ctx, args) => {
          customPager.paginate(args.paginationOpts);
          return await ctx.db.query("messages").paginate(args.paginationOpts);
        },
      });
    `;
    const result = runRule(convexNoMultiplePaginate, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
