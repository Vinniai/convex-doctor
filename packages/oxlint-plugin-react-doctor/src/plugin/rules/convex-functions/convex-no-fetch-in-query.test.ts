import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoFetchInQuery } from "./convex-no-fetch-in-query.js";

describe("convex-no-fetch-in-query", () => {
  it("flags fetch inside a query handler", () => {
    const code = `
      import { query } from "./_generated/server";
      export const enriched = query({
        args: {},
        handler: async (ctx) => {
          const response = await fetch("https://api.example.com/data");
          return response.json();
        },
      });
    `;
    const result = runRule(convexNoFetchInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags fetch inside a mutation handler", () => {
    const code = `
      import { mutation } from "./_generated/server";
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          const response = await fetch("https://api.example.com/validate");
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoFetchInQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag fetch inside an action handler", () => {
    const code = `
      import { action } from "./_generated/server";
      export const send = action({
        args: {},
        handler: async (ctx, args) => {
          const response = await fetch("https://api.example.com/send");
          return response.status;
        },
      });
    `;
    const result = runRule(convexNoFetchInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a locally imported fetch helper", () => {
    const code = `
      import { query } from "./_generated/server";
      import { fetch } from "./my-cache-fetch";
      export const cached = query({
        args: {},
        handler: async (ctx) => {
          return fetch("messages");
        },
      });
    `;
    const result = runRule(convexNoFetchInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a same-named registrar from a non-Convex module", () => {
    const code = `
      import { query } from "./my-query-library";
      export const enriched = query({
        handler: async (ctx) => fetch("https://api.example.com/data"),
      });
    `;
    const result = runRule(convexNoFetchInQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
