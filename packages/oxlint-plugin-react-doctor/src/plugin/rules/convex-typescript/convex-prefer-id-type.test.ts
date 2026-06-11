import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPreferIdType } from "./convex-prefer-id-type.js";

const CONVEX_FILE = { filename: "/proj/convex/messages.ts" };

describe("convex-prefer-id-type", () => {
  it("flags a string-typed id parameter passed to ctx.db.get", () => {
    const code = `
      import type { QueryCtx } from "./_generated/server";
      async function load(ctx: QueryCtx, messageId: string) {
        return ctx.db.get(messageId);
      }
    `;
    const result = runRule(convexPreferIdType, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag a parameter already typed Id<...>", () => {
    const code = `
      import type { QueryCtx } from "./_generated/server";
      import type { Id } from "./_generated/dataModel";
      async function load(ctx: QueryCtx, messageId: Id<"messages">) {
        return ctx.db.get(messageId);
      }
    `;
    const result = runRule(convexPreferIdType, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag string parameters whose name is not id-like", () => {
    const code = `
      import type { QueryCtx } from "./_generated/server";
      async function load(ctx: QueryCtx, userName: string) {
        return ctx.db.get(userName);
      }
    `;
    const result = runRule(convexPreferIdType, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a string id parameter never passed to ctx.db", () => {
    const code = `
      import type { QueryCtx } from "./_generated/server";
      async function describe(ctx: QueryCtx, messageId: string) {
        return "message " + messageId;
      }
    `;
    const result = runRule(convexPreferIdType, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("flags writes too — ctx.db.patch / ctx.db.delete", () => {
    const code = `
      import type { MutationCtx } from "./_generated/server";
      export const markRead = async (ctx: MutationCtx, messageId: string) => {
        await ctx.db.patch(messageId, { read: true });
      };
      export const remove = async (ctx: MutationCtx, id: string) => {
        await ctx.db.delete(id);
      };
    `;
    const result = runRule(convexPreferIdType, code, CONVEX_FILE);
    expect(result.diagnostics).toHaveLength(2);
  });

  it("does NOT flag the same code outside a convex directory", () => {
    const code = `
      async function load(ctx, messageId: string) {
        return ctx.db.get(messageId);
      }
    `;
    const result = runRule(convexPreferIdType, code, {
      filename: "/proj/src/repository.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the host provides no filename", () => {
    const code = `
      async function load(ctx, messageId: string) {
        return ctx.db.get(messageId);
      }
    `;
    const result = runRule(convexPreferIdType, code, { filename: undefined });
    expect(result.diagnostics).toHaveLength(0);
  });
});
