import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPaginateRequiresOptsValidator } from "./convex-paginate-requires-opts-validator.js";

describe("convex-paginate-requires-opts-validator", () => {
  it("flags .paginate when args lack paginationOpts", () => {
    const code = `
      import { query } from "./_generated/server";
      import { v } from "convex/values";
      export const list = query({
        args: { channel: v.string() },
        handler: async (ctx, args) => {
          return await ctx.db.query("messages").paginate(args.opts);
        },
      });
    `;
    const result = runRule(convexPaginateRequiresOptsValidator, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags .paginate when the function has no args validator at all", () => {
    const code = `
      import { query } from "./_generated/server";
      export const list = query({
        handler: async (ctx, args) => {
          return await ctx.db.query("messages").paginate(args.paginationOpts);
        },
      });
    `;
    const result = runRule(convexPaginateRequiresOptsValidator, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag when args include paginationOpts", () => {
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
    const result = runRule(convexPaginateRequiresOptsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when args reference paginationOptsValidator under another key", () => {
    const code = `
      import { query } from "./_generated/server";
      import { paginationOptsValidator } from "convex/server";
      export const list = query({
        args: { opts: paginationOptsValidator },
        handler: async (ctx, args) => {
          return await ctx.db.query("messages").paginate(args.opts);
        },
      });
    `;
    const result = runRule(convexPaginateRequiresOptsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when args are spread from a shared validator object", () => {
    const code = `
      import { query } from "./_generated/server";
      import { sharedArgs } from "./validators";
      export const list = query({
        args: { ...sharedArgs },
        handler: async (ctx, args) => {
          return await ctx.db.query("messages").paginate(args.paginationOpts);
        },
      });
    `;
    const result = runRule(convexPaginateRequiresOptsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a .paginate method on a non-db object", () => {
    const code = `
      import { query } from "./_generated/server";
      import { customPager } from "./pager";
      export const list = query({
        args: {},
        handler: async (ctx) => {
          return customPager.paginate({ numItems: 10 });
        },
      });
    `;
    const result = runRule(convexPaginateRequiresOptsValidator, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
