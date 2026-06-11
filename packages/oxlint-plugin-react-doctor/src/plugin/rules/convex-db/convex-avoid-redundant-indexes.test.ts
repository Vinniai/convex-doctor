import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexAvoidRedundantIndexes } from "./convex-avoid-redundant-indexes.js";

describe("convex-avoid-redundant-indexes", () => {
  it("flags an index whose fields are a strict prefix of another's", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ userId: v.string(), channel: v.string() })
          .index("by_user", ["userId"])
          .index("by_user_channel", ["userId", "channel"]),
      });
    `;
    const result = runRule(convexAvoidRedundantIndexes, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags the shorter index regardless of declaration order", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ userId: v.string(), channel: v.string(), ts: v.number() })
          .index("by_user_channel_ts", ["userId", "channel", "ts"])
          .index("by_user_channel", ["userId", "channel"]),
      });
    `;
    const result = runRule(convexAvoidRedundantIndexes, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag disjoint indexes", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        messages: defineTable({ userId: v.string(), channel: v.string() })
          .index("by_user", ["userId"])
          .index("by_channel", ["channel"]),
      });
    `;
    const result = runRule(convexAvoidRedundantIndexes, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag indexes that share a prefix but diverge", () => {
    const code = `
      import { defineSchema, defineTable } from "convex/server";
      import { v } from "convex/values";
      export default defineSchema({
        events: defineTable({ a: v.string(), b: v.string(), c: v.string() })
          .index("by_a_b", ["a", "b"])
          .index("by_a_c", ["a", "c"]),
      });
    `;
    const result = runRule(convexAvoidRedundantIndexes, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a defineTable from a non-Convex module", () => {
    const code = `
      import { defineTable } from "./my-orm";
      export const messages = defineTable({ userId: "string", channel: "string" })
        .index("by_user", ["userId"])
        .index("by_user_channel", ["userId", "channel"]);
    `;
    const result = runRule(convexAvoidRedundantIndexes, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
