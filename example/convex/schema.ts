import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Demo app tables for showing authorization in action
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatar: v.optional(v.string()),
  }).index("by_email", ["email"]),

  orgs: defineTable({
    name: v.string(),
    slug: v.string(),
    plan: v.string(),
  }).index("by_slug", ["slug"]),

  org_members: defineTable({
    orgId: v.id("orgs"),
    userId: v.id("users"),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  documents: defineTable({
    title: v.string(),
    content: v.optional(v.string()),
    orgId: v.id("orgs"),
    authorId: v.id("users"),
  }).index("by_org", ["orgId"]),
});
