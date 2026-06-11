import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoFloatingDbWrite } from "./convex-no-floating-db-write.js";

describe("convex-no-floating-db-write", () => {
  it("flags a bare ctx.db.insert statement", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoFloatingDbWrite, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags bare patch / replace / delete statements", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const update = mutation({
        args: {},
        handler: async (ctx, args) => {
          ctx.db.patch(args.id, { read: true });
          ctx.db.replace(args.id, { body: args.body });
          ctx.db.delete(args.id);
        },
      });
    `;
    const result = runRule(convexNoFloatingDbWrite, code);
    expect(result.diagnostics).toHaveLength(3);
  });

  it("does NOT flag awaited db writes", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoFloatingDbWrite, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a returned db write", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          return ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoFloatingDbWrite, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const add = mutation({
        handler: async (ctx) => {
          ctx.db.insert("anything", {});
        },
      });
    `;
    const result = runRule(convexNoFloatingDbWrite, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
