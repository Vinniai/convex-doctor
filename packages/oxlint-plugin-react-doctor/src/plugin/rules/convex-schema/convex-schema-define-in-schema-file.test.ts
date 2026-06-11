import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexSchemaDefineInSchemaFile } from "./convex-schema-define-in-schema-file.js";

const SCHEMA_CODE = `
  import { defineSchema, defineTable } from "convex/server";
  import { v } from "convex/values";
  export default defineSchema({
    messages: defineTable({ body: v.string(), userId: v.id("users") }).index("by_user", ["userId"]),
    users: defineTable({ name: v.string() }),
  });
`;

describe("convex-schema-define-in-schema-file", () => {
  it("flags defineSchema in a convex/ module other than schema.ts", () => {
    const result = runRule(convexSchemaDefineInSchemaFile, SCHEMA_CODE, {
      filename: "/proj/convex/tables.ts",
    });
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag defineSchema in convex/schema.ts", () => {
    const result = runRule(convexSchemaDefineInSchemaFile, SCHEMA_CODE, {
      filename: "/proj/convex/schema.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the host provides no filename", () => {
    const result = runRule(convexSchemaDefineInSchemaFile, SCHEMA_CODE, {
      filename: undefined,
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a file outside the convex/ directory", () => {
    const result = runRule(convexSchemaDefineInSchemaFile, SCHEMA_CODE, {
      filename: "/proj/src/db/schema-mirror.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a defineSchema from a non-Convex module", () => {
    const code = `
      import { defineSchema, defineTable } from "./my-orm";
      import { v } from "./my-validators";
      export default defineSchema({
        users: defineTable({ name: v.string() }),
      });
    `;
    const result = runRule(convexSchemaDefineInSchemaFile, code, {
      filename: "/proj/convex/tables.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });
});
