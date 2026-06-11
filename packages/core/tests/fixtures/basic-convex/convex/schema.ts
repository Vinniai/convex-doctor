import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }),
  messages: defineTable({
    body: v.string(),
    // convex-prefer-v-id: should be v.id("users")
    userId: v.string(),
    channel: v.string(),
  })
    // convex-avoid-redundant-indexes: prefix of by_channel_user
    .index("by_channel", ["channel"])
    .index("by_channel_user", ["channel", "userId"]),
});
