import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPreferVId } from "./convex-prefer-v-id.js";

describe("convex-prefer-v-id", () => {
  it("flags a v.string() field whose name implies a sibling table", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ body: v.string(), userId: v.string() }).index("by_user", ["userId"]),
        users: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexPreferVId, code);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("userId");
    expect(result.diagnostics[0].message).toContain("users");
  });

  it("flags a snake_case _id field matching a sibling table", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        posts: defineTable({ title: v.string(), author_id: v.string() }),
        authors: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexPreferVId, code);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("author_id");
  });

  it("does NOT flag external-service IDs with no matching table", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        users: defineTable({ name: v.string(), stripeCustomerId: v.string() }),
      });
    `;
    const result = runRule(convexPreferVId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag fields already declared with v.id()", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ body: v.string(), userId: v.id("users") }).index("by_user", ["userId"]),
        users: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexPreferVId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when v comes from a non-Convex module", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "./my-validators";
      export default defineSchema({
        messages: defineTable({ body: v.string(), userId: v.string() }),
        users: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexPreferVId, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when defineSchema/defineTable come from a non-Convex module", () => {
    const code = `
      import { defineSchema, defineTable } from "./my-orm";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ body: v.string(), userId: v.string() }),
        users: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexPreferVId, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
