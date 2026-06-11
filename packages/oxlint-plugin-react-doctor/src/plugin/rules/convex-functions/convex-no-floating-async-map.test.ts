import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoFloatingAsyncMap } from "./convex-no-floating-async-map.js";

describe("convex-no-floating-async-map", () => {
  it("flags a bare async .map that awaits ctx work", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const markRead = mutation({
        args: {},
        handler: async (ctx, args) => {
          args.ids.map(async (id) => {
            await ctx.db.patch(id, { read: true });
          });
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a bare async .map over destructured ctx properties", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const markRead = mutation({
        args: {},
        handler: async ({ db }, args) => {
          args.ids.map(async (id) => {
            await db.patch(id, { read: true });
          });
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag await Promise.all around the map", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const markRead = mutation({
        args: {},
        handler: async (ctx, args) => {
          await Promise.all(
            args.ids.map(async (id) => {
              await ctx.db.patch(id, { read: true });
            }),
          );
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a map result assigned to a variable", () => {
    const code = `
      import { query } from "./_generated/server";
      export const hydrate = query({
        args: {},
        handler: async (ctx, args) => {
          const promises = args.ids.map(async (id) => {
            return await ctx.db.get(id);
          });
          return Promise.all(promises);
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a synchronous map", () => {
    const code = `
      import { query } from "./_generated/server";
      export const names = query({
        args: {},
        handler: async (ctx, args) => {
          args.docs.map((doc) => doc.name);
          return null;
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an async map that never touches ctx", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const noop = mutation({
        args: {},
        handler: async (ctx, args) => {
          args.ids.map(async (id) => {
            await Promise.resolve(id);
          });
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const markRead = mutation({
        handler: async (ctx, args) => {
          args.ids.map(async (id) => {
            await ctx.db.patch(id, { read: true });
          });
        },
      });
    `;
    const result = runRule(convexNoFloatingAsyncMap, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
