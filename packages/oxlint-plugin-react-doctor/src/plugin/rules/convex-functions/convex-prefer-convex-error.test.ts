import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPreferConvexError } from "./convex-prefer-convex-error.js";

describe("convex-prefer-convex-error", () => {
  it("flags throw new Error inside a public mutation", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          if (!args.body) {
            throw new Error("Body is required");
          }
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexPreferConvexError, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags throw new Error inside a public query", () => {
    const code = `
      import { query } from "./_generated/server";
      export const get = query({
        args: {},
        handler: async (ctx, args) => {
          const doc = await ctx.db.get(args.id);
          if (!doc) throw new Error("Not found");
          return doc;
        },
      });
    `;
    const result = runRule(convexPreferConvexError, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag throw new ConvexError", () => {
    const code = `
      import { mutation } from "./_generated/server";
      import { ConvexError } from "convex/values";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          if (!args.body) {
            throw new ConvexError({ code: "BAD_REQUEST", message: "Body is required" });
          }
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexPreferConvexError, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag throw new Error inside an internalMutation", () => {
    const code = `
      import { internalMutation } from "./_generated/server";
      export const prune = internalMutation({
        args: {},
        handler: async (ctx) => {
          throw new Error("Internal invariant violated");
        },
      });
    `;
    const result = runRule(convexPreferConvexError, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag throws outside Convex handlers", () => {
    const code = `
      export const parse = (input) => {
        if (!input) throw new Error("missing input");
        return JSON.parse(input);
      };
    `;
    const result = runRule(convexPreferConvexError, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { mutation } from "./my-state-library";
      export const add = mutation({
        handler: async (ctx) => {
          throw new Error("anything");
        },
      });
    `;
    const result = runRule(convexPreferConvexError, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
