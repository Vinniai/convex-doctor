import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoCtxDbInAction } from "./convex-no-ctx-db-in-action.js";

describe("convex-no-ctx-db-in-action", () => {
  it("flags ctx.db reads inside an action handler", () => {
    const code = `
      import { action } from "./_generated/server";
      export const send = action({
        args: {},
        handler: async (ctx) => {
          const messages = await ctx.db.query("messages").collect();
          return messages;
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags ctx.db writes inside an internalAction handler", () => {
    const code = `
      import { internalAction } from "../_generated/server";
      export const ingest = internalAction({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("logs", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags ctx.db inside nested closures of an action handler", () => {
    const code = `
      import { action } from "./_generated/server";
      export const hydrate = action({
        args: {},
        handler: async (ctx, args) => {
          return Promise.all(args.ids.map(async (id) => ctx.db.get(id)));
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags destructuring db from the action ctx parameter", () => {
    const code = `
      import { action } from "./_generated/server";
      export const send = action({
        args: {},
        handler: async ({ db }) => {
          return db.query("messages").collect();
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags the legacy function shorthand too", () => {
    const code = `
      import { action } from "./_generated/server";
      export const send = action(async (ctx) => {
        await ctx.db.patch(id, { read: true });
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag ctx.db in queries and mutations", () => {
    const code = `
      import { mutation, query } from "./_generated/server";
      export const list = query({
        args: {},
        handler: async (ctx) => ctx.db.query("messages").collect(),
      });
      export const add = mutation({
        args: {},
        handler: async (ctx, args) => {
          await ctx.db.insert("messages", { body: args.body });
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag actions that use ctx.runQuery / ctx.runMutation", () => {
    const code = `
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const send = action({
        args: {},
        handler: async (ctx, args) => {
          const user = await ctx.runQuery(internal.users.get, { id: args.id });
          await ctx.runMutation(internal.messages.add, { body: args.body });
          return user;
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a homegrown action() helper from a non-Convex module", () => {
    const code = `
      import { action } from "./my-state-library";
      export const send = action({
        handler: async (ctx) => {
          await ctx.db.write("anything");
        },
      });
    `;
    const result = runRule(convexNoCtxDbInAction, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
