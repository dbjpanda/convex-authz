import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { isExpired, matchesScope } from "./helpers.js";
import { scopeValidator } from "./validators.js";
import { paginator } from "convex-helpers/server/pagination";
import schema from "./schema.js";

/**
 * Get all role assignments for a user
 */
export const getUserRoles = query({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    scope: scopeValidator,
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      role: v.string(),
      scope: v.optional(
        v.object({
          type: v.string(),
          id: v.string(),
        })
      ),
      metadata: v.optional(v.any()),
      expiresAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.userId)
      )
      .take(1000);

    // Filter out expired assignments and optionally filter by scope
    const validAssignments = assignments.filter((a) => {
      if (isExpired(a.expiresAt)) return false;
      if (args.scope && !matchesScope(a.scope, args.scope)) return false;
      return true;
    });

    return validAssignments.map((a) => ({
      _id: a._id as string,
      role: a.role,
      scope: a.scope,
      metadata: a.metadata,
      expiresAt: a.expiresAt,
    }));
  },
});

/**
 * Check if a user has a specific role
 */
export const hasRole = query({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    role: v.string(),
    scope: scopeValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_tenant_user_and_role", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("userId", args.userId)
          .eq("role", args.role)
      )
      .take(100);

    // Check for valid assignment with matching scope
    return assignments.some((a) => {
      if (isExpired(a.expiresAt)) return false;
      return matchesScope(a.scope, args.scope);
    });
  },
});

/**
 * Get all user attributes
 */
export const getUserAttributes = query({
  args: {
    tenantId: v.string(),
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      key: v.string(),
      value: v.any(),
    })
  ),
  handler: async (ctx, args) => {
    const attributes = await ctx.db
      .query("userAttributes")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.userId)
      )
      .take(1000);

    return attributes.map((a) => ({
      _id: a._id as string,
      key: a.key,
      value: a.value,
    }));
  },
});

/**
 * Get a specific user attribute
 */
export const getUserAttribute = query({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    key: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const attribute = await ctx.db
      .query("userAttributes")
      .withIndex("by_tenant_user_and_key", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("userId", args.userId)
          .eq("key", args.key)
      )
      .unique();

    return attribute?.value ?? null;
  },
});

/**
 * Get all permission overrides for a user
 */
export const getPermissionOverrides = query({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    permission: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      permission: v.string(),
      effect: v.union(v.literal("allow"), v.literal("deny")),
      scope: v.optional(
        v.object({
          type: v.string(),
          id: v.string(),
        })
      ),
      reason: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    let overrides;

    if (args.permission !== undefined) {
      overrides = await ctx.db
        .query("permissionOverrides")
        .withIndex("by_tenant_user_and_permission", (q) =>
          q
            .eq("tenantId", args.tenantId)
            .eq("userId", args.userId)
            .eq("permission", args.permission as string)
        )
        .take(1000);
    } else {
      overrides = await ctx.db
        .query("permissionOverrides")
        .withIndex("by_tenant_user", (q) =>
          q.eq("tenantId", args.tenantId).eq("userId", args.userId)
        )
        .take(1000);
    }

    // Filter out expired overrides
    const validOverrides = overrides.filter(
      (o) => !isExpired(o.expiresAt ?? undefined)
    );

    return validOverrides.map((o) => ({
      _id: o._id as string,
      permission: o.permission,
      effect: o.effect,
      scope: o.scope,
      reason: o.reason,
      expiresAt: o.expiresAt ?? undefined,
    }));
  },
});

/**
 * Get users with a specific role
 */
export const getUsersWithRole = query({
  args: {
    tenantId: v.string(),
    role: v.string(),
    scope: scopeValidator,
  },
  returns: v.array(
    v.object({
      userId: v.string(),
      assignedAt: v.number(),
      expiresAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_tenant_role", (q) =>
        q.eq("tenantId", args.tenantId).eq("role", args.role)
      )
      .take(8000);

    const validAssignments = assignments.filter((a) => {
      if (isExpired(a.expiresAt)) return false;
      if (args.scope && !matchesScope(a.scope, args.scope)) return false;
      return true;
    });

    return validAssignments.map((a) => ({
      userId: a.userId,
      assignedAt: a._creationTime,
      expiresAt: a.expiresAt,
    }));
  },
});

const auditLogActionValidator = v.union(
  v.literal("permission_check"),
  v.literal("role_assigned"),
  v.literal("role_revoked"),
  v.literal("permission_granted"),
  v.literal("permission_denied"),
  v.literal("attribute_set"),
  v.literal("attribute_removed"),
  v.literal("relation_added"),
  v.literal("relation_removed"),
  v.literal("policy_evaluated")
);

const auditEntryShape = v.object({
  _id: v.string(),
  timestamp: v.number(),
  action: v.string(),
  userId: v.string(),
  actorId: v.optional(v.string()),
  details: v.any(),
});

/**
 * Get recent audit log entries.
 * With paginationOpts returns { page, isDone, continueCursor }; otherwise returns an array (limit default 100).
 */
export const getAuditLog = query({
  args: {
    tenantId: v.string(),
    userId: v.optional(v.string()),
    action: v.optional(auditLogActionValidator),
    limit: v.optional(v.number()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  returns: v.union(
    v.array(auditEntryShape),
    v.object({
      page: v.array(auditEntryShape),
      isDone: v.boolean(),
      continueCursor: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const mapEntry = (e: {
      _id: unknown;
      timestamp: number;
      action: string;
      userId: string;
      actorId?: string;
      details: unknown;
    }) => ({
      _id: e._id as string,
      timestamp: e.timestamp,
      action: e.action,
      userId: e.userId,
      actorId: e.actorId,
      details: e.details,
    });

    let dbQuery;
    const db = args.paginationOpts ? paginator(ctx.db, schema) : ctx.db;
    if (args.userId !== undefined) {
      dbQuery = db
        .query("auditLog")
        .withIndex("by_tenant_user", (q) =>
          q
            .eq("tenantId", args.tenantId)
            .eq("userId", args.userId as string)
        );
    } else if (args.action !== undefined) {
      dbQuery = db
        .query("auditLog")
        .withIndex("by_tenant_action", (q) =>
          q
            .eq("tenantId", args.tenantId)
            .eq(
              "action",
              args.action as
                | "permission_check"
                | "role_assigned"
                | "role_revoked"
                | "permission_granted"
                | "permission_denied"
                | "attribute_set"
                | "attribute_removed"
                | "relation_added"
                | "relation_removed"
                | "policy_evaluated"
            )
        );
    } else {
      dbQuery = db
        .query("auditLog")
        .withIndex("by_tenant_timestamp", (q) =>
          q.eq("tenantId", args.tenantId)
        );
    }

    const ordered = dbQuery.order("desc");

    if (args.paginationOpts !== undefined) {
      const result = await ordered.paginate(args.paginationOpts);
      return {
        page: result.page.map(mapEntry),
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    const limit = args.limit ?? 100;
    const entries = await ordered.take(limit);
    return entries.map(mapEntry);
  },
});
