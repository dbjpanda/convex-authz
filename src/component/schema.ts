import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { scopeValidator } from "./validators";

export default defineSchema({
  roleAssignments: defineTable({
    tenantId: v.optional(v.string()),
    userId: v.string(),
    role: v.string(),
    scope: scopeValidator,
    metadata: v.optional(v.any()),
    assignedBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_role", ["tenantId", "role"])
    .index("by_tenant_user_and_role", ["tenantId", "userId", "role"]),

  userAttributes: defineTable({
    tenantId: v.optional(v.string()),
    userId: v.string(),
    key: v.string(),
    value: v.any(),
  })
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_user_and_key", ["tenantId", "userId", "key"]),

  permissionOverrides: defineTable({
    tenantId: v.optional(v.string()),
    userId: v.string(),
    permission: v.string(),
    effect: v.union(v.literal("allow"), v.literal("deny")),
    scope: scopeValidator,
    reason: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_user_and_permission", [
      "tenantId",
      "userId",
      "permission",
    ]),

  relationships: defineTable({
    tenantId: v.optional(v.string()),
    subjectType: v.string(),
    subjectId: v.string(),
    relation: v.string(),
    objectType: v.string(),
    objectId: v.string(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    // v2: optional caveat (ABAC condition on an edge)
    caveat: v.optional(v.string()),         // name of a registered caveat function
    caveatContext: v.optional(v.any()),     // static context passed to caveat at eval time
  })
    .index("by_tenant_subject", ["tenantId", "subjectType", "subjectId"])
    .index("by_tenant_object", ["tenantId", "objectType", "objectId"])
    .index("by_tenant_subject_relation_object", [
      "tenantId",
      "subjectType",
      "subjectId",
      "relation",
      "objectType",
      "objectId",
    ])
    .index("by_tenant_object_relation", [
      "tenantId",
      "objectType",
      "objectId",
      "relation",
    ]),

  effectivePermissions: defineTable({
    tenantId: v.optional(v.string()),
    userId: v.string(),
    permission: v.string(),
    scopeKey: v.string(),
    scope: scopeValidator,
    effect: v.union(v.literal("allow"), v.literal("deny")),
    sources: v.array(v.string()),
    directGrant: v.optional(v.boolean()),
    directDeny: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    grantedBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // v2: policy evaluation result
    policyResult: v.optional(v.union(
      v.literal("allow"),
      v.literal("deny"),
      v.literal("deferred"),     // must re-evaluate at read time
    )),
    policyName: v.optional(v.string()),
  })
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_user_scope", ["tenantId", "userId", "scopeKey"])
    .index("by_tenant_user_permission_scope", [
      "tenantId",
      "userId",
      "permission",
      "scopeKey",
    ]),

  effectiveRoles: defineTable({
    tenantId: v.optional(v.string()),
    userId: v.string(),
    role: v.string(),
    scopeKey: v.string(),
    scope: scopeValidator,
    assignedBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_user_scope", ["tenantId", "userId", "scopeKey"])
    .index("by_tenant_user_role_scope", [
      "tenantId",
      "userId",
      "role",
      "scopeKey",
    ]),

  effectiveRelationships: defineTable({
    tenantId: v.optional(v.string()),
    subjectKey: v.string(),
    subjectType: v.string(),
    subjectId: v.string(),
    relation: v.string(),
    objectKey: v.string(),
    objectType: v.string(),
    objectId: v.string(),
    isDirect: v.boolean(),
    inheritedFrom: v.union(v.string(), v.null()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    // v2: depth for traversal debugging
    depth: v.optional(v.number()),
  })
    .index("by_tenant_subject", ["tenantId", "subjectKey"])
    .index("by_tenant_object", ["tenantId", "objectKey"])
    .index("by_tenant_subject_relation", [
      "tenantId",
      "subjectKey",
      "relation",
    ])
    .index("by_tenant_subject_relation_object", [
      "tenantId",
      "subjectKey",
      "relation",
      "objectKey",
    ])
    .index("by_tenant_inherited_from", ["tenantId", "inheritedFrom"]),

  auditLog: defineTable({
    tenantId: v.optional(v.string()),
    timestamp: v.number(),
    action: v.union(
      v.literal("permission_check"),
      v.literal("role_assigned"),
      v.literal("role_revoked"),
      v.literal("permission_granted"),
      v.literal("permission_denied"),
      v.literal("permission_override_removed"),
      v.literal("attribute_set"),
      v.literal("attribute_removed"),
      v.literal("relation_added"),
      v.literal("relation_removed"),
      v.literal("policy_evaluated")
    ),
    userId: v.string(),
    actorId: v.optional(v.string()),
    details: v.object({
      permission: v.optional(v.string()),
      role: v.optional(v.string()),
      result: v.optional(v.boolean()),
      scope: scopeValidator,
      attribute: v.optional(
        v.object({
          key: v.string(),
          value: v.optional(v.any()),
        })
      ),
      reason: v.optional(v.string()),
      // v2: ReBAC relation details
      relation: v.optional(v.string()),
      subject: v.optional(v.string()),
      object: v.optional(v.string()),
    }),
  })
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_action", ["tenantId", "action"])
    .index("by_tenant_timestamp", ["tenantId", "timestamp"]),
});
