import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexSchemaNoReservedFields } from "./convex-schema-no-reserved-fields.js";

describe("convex-schema-no-reserved-fields", () => {
  it("flags a declared _creationTime field", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({
          body: v.string(),
          _creationTime: v.number(),
        }),
      });
    `;
    const result = runRule(convexSchemaNoReservedFields, code);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("_creationTime");
  });

  it("flags any custom underscore-prefixed field", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        users: defineTable({
          name: v.string(),
          _custom: v.string(),
        }),
      });
    `;
    const result = runRule(convexSchemaNoReservedFields, code);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("_custom");
  });

  it("does NOT flag normal fields", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ body: v.string(), userId: v.id("users") }).index("by_user", ["userId"]),
        users: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexSchemaNoReservedFields, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a defineTable from a non-Convex module", () => {
    const code = `
      import { defineSchema, defineTable } from "./my-orm";
      import { v } from "./my-validators";
      export default defineSchema({
        messages: defineTable({
          _id: v.string(),
          _creationTime: v.number(),
        }),
      });
    `;
    const result = runRule(convexSchemaNoReservedFields, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
