import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoApiSelfCall } from "./convex-no-api-self-call.js";

const MESSAGES_FILE = { filename: "/proj/convex/messages.ts" };

describe("convex-no-api-self-call", () => {
  it("flags api.<ownModule>.* references inside the module's own file", () => {
    const code = `
      import { action } from "./_generated/server";
      import { api } from "./_generated/api";
      export const resend = action({
        args: {},
        handler: async (ctx) => {
          return ctx.runQuery(api.messages.list, {});
        },
      });
    `;
    const result = runRule(convexNoApiSelfCall, code, MESSAGES_FILE);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag api references to OTHER modules", () => {
    const code = `
      import { action } from "./_generated/server";
      import { api } from "./_generated/api";
      export const resend = action({
        args: {},
        handler: async (ctx, args) => {
          return ctx.runQuery(api.users.get, { id: args.id });
        },
      });
    `;
    const result = runRule(convexNoApiSelfCall, code, MESSAGES_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag internal.* references to the same module", () => {
    const code = `
      import { action } from "./_generated/server";
      import { internal } from "./_generated/api";
      export const resend = action({
        args: {},
        handler: async (ctx) => {
          return ctx.runQuery(internal.messages.list, {});
        },
      });
    `;
    const result = runRule(convexNoApiSelfCall, code, MESSAGES_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("handles a renamed api import", () => {
    const code = `
      import { api as publicApi } from "./_generated/api";
      export const reference = publicApi.messages.list;
    `;
    const result = runRule(convexNoApiSelfCall, code, MESSAGES_FILE);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("compares only the first path segment for nested modules", () => {
    const code = `
      import { api } from "../_generated/api";
      export const reference = api.users.profile.load;
    `;
    const result = runRule(convexNoApiSelfCall, code, {
      filename: "/proj/convex/users/profile.ts",
    });
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag an api binding from a non-generated module", () => {
    const code = `
      import { api } from "./my-client";
      export const reference = api.messages.list;
    `;
    const result = runRule(convexNoApiSelfCall, code, MESSAGES_FILE);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the host provides no filename", () => {
    const code = `
      import { api } from "./_generated/api";
      export const reference = api.messages.list;
    `;
    const result = runRule(convexNoApiSelfCall, code, { filename: undefined });
    expect(result.diagnostics).toHaveLength(0);
  });
});
