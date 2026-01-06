import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isExpired } from "./helpers";

/**
 * Assign a role to a user
 */
export const assignRole = mutation({
  args: {
    userId: v.string(),
    role: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    metadata: v.optional(v.any()),
    assignedBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Check if this exact role assignment already exists
    const existingAssignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_user_and_role", (q) =>
        q.eq("userId", args.userId).eq("role", args.role)
      )
      .collect();

    // Check for duplicate (same role + same scope)
    const duplicate = existingAssignments.find((a) => {
      if (isExpired(a.expiresAt)) return false;

      // Compare scopes
      if (!a.scope && !args.scope) return true;
      if (!a.scope || !args.scope) return false;
      return a.scope.type === args.scope.type && a.scope.id === args.scope.id;
    });

    if (duplicate) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: `User already has role "${args.role}" with the same scope`,
      });
    }

    // Create the role assignment
    const assignmentId = await ctx.db.insert("roleAssignments", {
      userId: args.userId,
      role: args.role,
      scope: args.scope,
      metadata: args.metadata,
      assignedBy: args.assignedBy,
      expiresAt: args.expiresAt,
    });

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: "role_assigned",
        userId: args.userId,
        actorId: args.assignedBy,
        details: {
          role: args.role,
          scope: args.scope,
        },
      });
    }

    return assignmentId as string;
  },
});

/**
 * Revoke a role from a user
 */
export const revokeRole = mutation({
  args: {
    userId: v.string(),
    role: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    revokedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_user_and_role", (q) =>
        q.eq("userId", args.userId).eq("role", args.role)
      )
      .collect();

    // Find matching assignment (same scope)
    const toRevoke = assignments.find((a) => {
      if (!a.scope && !args.scope) return true;
      if (!a.scope || !args.scope) return false;
      return a.scope.type === args.scope.type && a.scope.id === args.scope.id;
    });

    if (!toRevoke) {
      return false;
    }

    await ctx.db.delete(toRevoke._id);

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: "role_revoked",
        userId: args.userId,
        actorId: args.revokedBy,
        details: {
          role: args.role,
          scope: args.scope,
        },
      });
    }

    return true;
  },
});

/**
 * Revoke all roles from a user
 */
export const revokeAllRoles = mutation({
  args: {
    userId: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    revokedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let revokedCount = 0;

    for (const assignment of assignments) {
      // If scope is specified, only revoke matching scope
      if (args.scope) {
        if (!assignment.scope) continue;
        if (
          assignment.scope.type !== args.scope.type ||
          assignment.scope.id !== args.scope.id
        ) {
          continue;
        }
      }

      await ctx.db.delete(assignment._id);
      revokedCount++;

      // Log audit entry if enabled
      if (args.enableAudit) {
        await ctx.db.insert("auditLog", {
          timestamp: Date.now(),
          action: "role_revoked",
          userId: args.userId,
          actorId: args.revokedBy,
          details: {
            role: assignment.role,
            scope: assignment.scope,
          },
        });
      }
    }

    return revokedCount;
  },
});

/**
 * Set a user attribute
 */
export const setAttribute = mutation({
  args: {
    userId: v.string(),
    key: v.string(),
    value: v.any(),
    setBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Check if attribute already exists
    const existing = await ctx.db
      .query("userAttributes")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key)
      )
      .unique();

    if (existing) {
      // Update existing attribute
      await ctx.db.patch(existing._id, { value: args.value });

      // Log audit entry if enabled
      if (args.enableAudit) {
        await ctx.db.insert("auditLog", {
          timestamp: Date.now(),
          action: "attribute_set",
          userId: args.userId,
          actorId: args.setBy,
          details: {
            attribute: {
              key: args.key,
              value: args.value,
            },
          },
        });
      }

      return existing._id as string;
    }

    // Create new attribute
    const attributeId = await ctx.db.insert("userAttributes", {
      userId: args.userId,
      key: args.key,
      value: args.value,
    });

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: "attribute_set",
        userId: args.userId,
        actorId: args.setBy,
        details: {
          attribute: {
            key: args.key,
            value: args.value,
          },
        },
      });
    }

    return attributeId as string;
  },
});

/**
 * Remove a user attribute
 */
export const removeAttribute = mutation({
  args: {
    userId: v.string(),
    key: v.string(),
    removedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userAttributes")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key)
      )
      .unique();

    if (!existing) {
      return false;
    }

    await ctx.db.delete(existing._id);

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: "attribute_removed",
        userId: args.userId,
        actorId: args.removedBy,
        details: {
          attribute: {
            key: args.key,
          },
        },
      });
    }

    return true;
  },
});

/**
 * Remove all user attributes
 */
export const removeAllAttributes = mutation({
  args: {
    userId: v.string(),
    removedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const attributes = await ctx.db
      .query("userAttributes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const attribute of attributes) {
      await ctx.db.delete(attribute._id);

      // Log audit entry if enabled
      if (args.enableAudit) {
        await ctx.db.insert("auditLog", {
          timestamp: Date.now(),
          action: "attribute_removed",
          userId: args.userId,
          actorId: args.removedBy,
          details: {
            attribute: {
              key: attribute.key,
            },
          },
        });
      }
    }

    return attributes.length;
  },
});

/**
 * Grant a permission override
 */
export const grantPermission = mutation({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    reason: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Check for existing override with same permission and scope
    const existing = await ctx.db
      .query("permissionOverrides")
      .withIndex("by_user_and_permission", (q) =>
        q.eq("userId", args.userId).eq("permission", args.permission)
      )
      .collect();

    const duplicate = existing.find((o) => {
      if (isExpired(o.expiresAt)) return false;
      if (!o.scope && !args.scope) return true;
      if (!o.scope || !args.scope) return false;
      return o.scope.type === args.scope.type && o.scope.id === args.scope.id;
    });

    if (duplicate) {
      // Update existing override
      await ctx.db.patch(duplicate._id, {
        effect: "allow",
        reason: args.reason,
        createdBy: args.createdBy,
        expiresAt: args.expiresAt,
      });

      // Log audit entry if enabled
      if (args.enableAudit) {
        await ctx.db.insert("auditLog", {
          timestamp: Date.now(),
          action: "permission_granted",
          userId: args.userId,
          actorId: args.createdBy,
          details: {
            permission: args.permission,
            scope: args.scope,
            reason: args.reason,
          },
        });
      }

      return duplicate._id as string;
    }

    // Create new override
    const overrideId = await ctx.db.insert("permissionOverrides", {
      userId: args.userId,
      permission: args.permission,
      effect: "allow",
      scope: args.scope,
      reason: args.reason,
      createdBy: args.createdBy,
      expiresAt: args.expiresAt,
    });

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: "permission_granted",
        userId: args.userId,
        actorId: args.createdBy,
        details: {
          permission: args.permission,
          scope: args.scope,
          reason: args.reason,
        },
      });
    }

    return overrideId as string;
  },
});

/**
 * Deny a permission (create deny override)
 */
export const denyPermission = mutation({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    reason: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Check for existing override with same permission and scope
    const existing = await ctx.db
      .query("permissionOverrides")
      .withIndex("by_user_and_permission", (q) =>
        q.eq("userId", args.userId).eq("permission", args.permission)
      )
      .collect();

    const duplicate = existing.find((o) => {
      if (isExpired(o.expiresAt)) return false;
      if (!o.scope && !args.scope) return true;
      if (!o.scope || !args.scope) return false;
      return o.scope.type === args.scope.type && o.scope.id === args.scope.id;
    });

    if (duplicate) {
      // Update existing override
      await ctx.db.patch(duplicate._id, {
        effect: "deny",
        reason: args.reason,
        createdBy: args.createdBy,
        expiresAt: args.expiresAt,
      });

      // Log audit entry if enabled
      if (args.enableAudit) {
        await ctx.db.insert("auditLog", {
          timestamp: Date.now(),
          action: "permission_denied",
          userId: args.userId,
          actorId: args.createdBy,
          details: {
            permission: args.permission,
            scope: args.scope,
            reason: args.reason,
          },
        });
      }

      return duplicate._id as string;
    }

    // Create new override
    const overrideId = await ctx.db.insert("permissionOverrides", {
      userId: args.userId,
      permission: args.permission,
      effect: "deny",
      scope: args.scope,
      reason: args.reason,
      createdBy: args.createdBy,
      expiresAt: args.expiresAt,
    });

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: "permission_denied",
        userId: args.userId,
        actorId: args.createdBy,
        details: {
          permission: args.permission,
          scope: args.scope,
          reason: args.reason,
        },
      });
    }

    return overrideId as string;
  },
});

/**
 * Remove a permission override
 */
export const removePermissionOverride = mutation({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    removedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("permissionOverrides")
      .withIndex("by_user_and_permission", (q) =>
        q.eq("userId", args.userId).eq("permission", args.permission)
      )
      .collect();

    const toRemove = existing.find((o) => {
      if (!o.scope && !args.scope) return true;
      if (!o.scope || !args.scope) return false;
      return o.scope.type === args.scope.type && o.scope.id === args.scope.id;
    });

    if (!toRemove) {
      return false;
    }

    await ctx.db.delete(toRemove._id);

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        action: toRemove.effect === "allow" ? "permission_denied" : "permission_granted",
        userId: args.userId,
        actorId: args.removedBy,
        details: {
          permission: args.permission,
          scope: args.scope,
          reason: "Override removed",
        },
      });
    }

    return true;
  },
});

/**
 * Log a permission check to the audit log
 */
export const logPermissionCheck = mutation({
  args: {
    userId: v.string(),
    permission: v.string(),
    result: v.boolean(),
    scope: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
      })
    ),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      timestamp: Date.now(),
      action: "permission_check",
      userId: args.userId,
      details: {
        permission: args.permission,
        result: args.result,
        scope: args.scope,
        reason: args.reason,
      },
    });

    return null;
  },
});

/**
 * Clean up expired role assignments and permission overrides
 */
export const cleanupExpired = mutation({
  args: {},
  returns: v.object({
    expiredRoles: v.number(),
    expiredOverrides: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let expiredRoles = 0;
    let expiredOverrides = 0;

    // Clean up expired role assignments
    const allRoleAssignments = await ctx.db.query("roleAssignments").collect();
    for (const assignment of allRoleAssignments) {
      if (assignment.expiresAt && assignment.expiresAt < now) {
        await ctx.db.delete(assignment._id);
        expiredRoles++;
      }
    }

    // Clean up expired permission overrides
    const allOverrides = await ctx.db.query("permissionOverrides").collect();
    for (const override of allOverrides) {
      if (override.expiresAt && override.expiresAt < now) {
        await ctx.db.delete(override._id);
        expiredOverrides++;
      }
    }

    return { expiredRoles, expiredOverrides };
  },
});
