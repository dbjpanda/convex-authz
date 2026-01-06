import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  isExpired,
  matchesScope,
  matchesPermissionPattern,
} from "./helpers";

/**
 * Get all role assignments for a user
 */
export const getUserRoles = query({
  args: {
    userId: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
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
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

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
    userId: v.string(),
    role: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_user_and_role", (q) =>
        q.eq("userId", args.userId).eq("role", args.role)
      )
      .collect();

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
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

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
    userId: v.string(),
    key: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const attribute = await ctx.db
      .query("userAttributes")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key)
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
        .withIndex("by_user_and_permission", (q) =>
          q.eq("userId", args.userId).eq("permission", args.permission as string)
        )
        .collect();
    } else {
      overrides = await ctx.db
        .query("permissionOverrides")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    // Filter out expired overrides
    const validOverrides = overrides.filter((o) => !isExpired(o.expiresAt ?? undefined));

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
 * Check if a user has a specific permission
 * This is the core permission check query that evaluates:
 * 1. Permission overrides (explicit allow/deny)
 * 2. Role-based permissions (using provided role definitions)
 */
export const checkPermission = query({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    rolePermissions: v.record(v.string(), v.array(v.string())), // Role -> Permissions mapping
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.string(),
    matchedRole: v.optional(v.string()),
    matchedOverride: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Step 1: Check permission overrides
    const overrides = await ctx.db
      .query("permissionOverrides")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const validOverrides = overrides.filter((o) => !isExpired(o.expiresAt));

    // Check for explicit deny first
    for (const override of validOverrides) {
      if (
        override.effect === "deny" &&
        matchesPermissionPattern(args.permission, override.permission) &&
        matchesScope(override.scope, args.scope)
      ) {
        return {
          allowed: false,
          reason: override.reason ?? "Explicitly denied by override",
          matchedOverride: override._id as string,
        };
      }
    }

    // Check for explicit allow
    for (const override of validOverrides) {
      if (
        override.effect === "allow" &&
        matchesPermissionPattern(args.permission, override.permission) &&
        matchesScope(override.scope, args.scope)
      ) {
        return {
          allowed: true,
          reason: override.reason ?? "Explicitly allowed by override",
          matchedOverride: override._id as string,
        };
      }
    }

    // Step 2: Check role-based permissions
    const roleAssignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const validAssignments = roleAssignments.filter((a) => {
      if (isExpired(a.expiresAt)) return false;
      return matchesScope(a.scope, args.scope);
    });

    // Check if any role grants the permission
    for (const assignment of validAssignments) {
      const rolePerms = args.rolePermissions[assignment.role];
      if (rolePerms) {
        for (const rolePerm of rolePerms) {
          if (matchesPermissionPattern(args.permission, rolePerm)) {
            return {
              allowed: true,
              reason: `Granted by role: ${assignment.role}`,
              matchedRole: assignment.role,
            };
          }
        }
      }
    }

    // No permission found
    return {
      allowed: false,
      reason: "No role or override grants this permission",
    };
  },
});

/**
 * Get all effective permissions for a user
 * Combines role-based permissions and overrides
 */
export const getEffectivePermissions = query({
  args: {
    userId: v.string(),
    rolePermissions: v.record(v.string(), v.array(v.string())),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
  },
  returns: v.object({
    permissions: v.array(v.string()),
    roles: v.array(v.string()),
    deniedPermissions: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get role assignments
    const roleAssignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const validAssignments = roleAssignments.filter((a) => {
      if (isExpired(a.expiresAt)) return false;
      return matchesScope(a.scope, args.scope);
    });

    const roles: Array<string> = validAssignments.map((a) => a.role);

    // Collect permissions from roles
    const permissions = new Set<string>();
    for (const role of roles) {
      const rolePerms = args.rolePermissions[role];
      if (rolePerms) {
        for (const perm of rolePerms) {
          permissions.add(perm);
        }
      }
    }

    // Get overrides
    const overrides = await ctx.db
      .query("permissionOverrides")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const validOverrides = overrides.filter((o) => {
      if (isExpired(o.expiresAt)) return false;
      return matchesScope(o.scope, args.scope);
    });

    // Apply overrides
    const deniedPermissions: Array<string> = [];
    for (const override of validOverrides) {
      if (override.effect === "allow") {
        permissions.add(override.permission);
      } else if (override.effect === "deny") {
        permissions.delete(override.permission);
        deniedPermissions.push(override.permission);
      }
    }

    return {
      permissions: Array.from(permissions),
      roles,
      deniedPermissions,
    };
  },
});

/**
 * Get users with a specific role
 */
export const getUsersWithRole = query({
  args: {
    role: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
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
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect();

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

/**
 * Get recent audit log entries
 */
export const getAuditLog = query({
  args: {
    userId: v.optional(v.string()),
    action: v.optional(
      v.union(
        v.literal("permission_check"),
        v.literal("role_assigned"),
        v.literal("role_revoked"),
        v.literal("permission_granted"),
        v.literal("permission_denied"),
        v.literal("attribute_set"),
        v.literal("attribute_removed")
      )
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      timestamp: v.number(),
      action: v.string(),
      userId: v.string(),
      actorId: v.optional(v.string()),
      details: v.any(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let dbQuery;
    if (args.userId !== undefined) {
      dbQuery = ctx.db
        .query("auditLog")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as string));
    } else if (args.action !== undefined) {
      dbQuery = ctx.db
        .query("auditLog")
        .withIndex("by_action", (q) => q.eq("action", args.action as "permission_check" | "role_assigned" | "role_revoked" | "permission_granted" | "permission_denied" | "attribute_set" | "attribute_removed"));
    } else {
      dbQuery = ctx.db.query("auditLog").withIndex("by_timestamp");
    }

    const entries = await dbQuery.order("desc").take(limit);

    return entries.map((e) => ({
      _id: e._id as string,
      timestamp: e.timestamp,
      action: e.action,
      userId: e.userId,
      actorId: e.actorId,
      details: e.details,
    }));
  },
});
