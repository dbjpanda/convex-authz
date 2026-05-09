/**
 * Custom Roles
 *
 * Tenant-admin-defined role bundles, composed at runtime from a SaaS-provider-
 * supplied permission whitelist. Identified by `Id<"customRoles">`; stored in
 * `roleAssignments.role` as the namespaced string `"custom:<id>"` so the
 * existing read path (`hasRoleFast`, `checkPermissionFast`) treats them
 * uniformly with system roles. The whitelist (`grantablePermissions`) is
 * passed as a mutation arg by the developer's app — the SaaS provider owns
 * the whitelist; tenant admins compose, never invent.
 *
 * See plan: /Users/dj/.claude/plans/create-a-plan-to-gleaming-fountain.md
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";

const DEFAULT_MAX_ROLES_PER_TENANT = 100;
const CUSTOM_ROLE_PREFIX = "custom:";

/** Build the namespaced role string stored in `roleAssignments.role`. */
export function customRoleStringFromId(id: Id<"customRoles">): string {
  return `${CUSTOM_ROLE_PREFIX}${id}`;
}

const customRoleDocValidator = v.object({
  _id: v.id("customRoles"),
  _creationTime: v.number(),
  tenantId: v.string(),
  name: v.string(),
  permissions: v.array(v.string()),
  description: v.optional(v.string()),
  createdBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Validate that every requested permission appears in the SaaS-provider
 * whitelist. Empty whitelist is a configuration error caught at SDK init,
 * so we treat it here as zero grantable permissions.
 */
function assertPermissionsGrantable(
  permissions: readonly string[],
  grantablePermissions: readonly string[],
): void {
  const allowed = new Set(grantablePermissions);
  for (const perm of permissions) {
    if (!allowed.has(perm)) {
      throw new ConvexError({
        code: "PERMISSION_NOT_GRANTABLE",
        message: `Permission "${perm}" is not in grantablePermissions whitelist`,
        permission: perm,
      });
    }
  }
}

/**
 * Create a tenant-scoped custom role.
 *
 * Throws ConvexError on:
 *   - PERMISSION_NOT_GRANTABLE — a permission isn't in the whitelist
 *   - CUSTOM_ROLE_LIMIT_EXCEEDED — tenant already at the cap
 *   - CUSTOM_ROLE_NAME_TAKEN — a role with this name already exists in the tenant
 */
export const createCustomRole = mutation({
  args: {
    tenantId: v.string(),
    name: v.string(),
    permissions: v.array(v.string()),
    description: v.optional(v.string()),
    createdBy: v.string(),
    grantablePermissions: v.array(v.string()),
    maxRolesPerTenant: v.optional(v.number()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.id("customRoles"),
  handler: async (ctx, args) => {
    if (args.name.trim().length === 0) {
      throw new ConvexError({
        code: "INVALID_CUSTOM_ROLE_NAME",
        message: "Custom role name must be a non-empty string",
      });
    }

    assertPermissionsGrantable(args.permissions, args.grantablePermissions);

    const cap = args.maxRolesPerTenant ?? DEFAULT_MAX_ROLES_PER_TENANT;
    const existingForTenant = await ctx.db
      .query("customRoles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(cap + 1);

    if (existingForTenant.length >= cap) {
      throw new ConvexError({
        code: "CUSTOM_ROLE_LIMIT_EXCEEDED",
        message: `Tenant has reached the custom role limit (${cap})`,
        limit: cap,
      });
    }

    const nameClash = await ctx.db
      .query("customRoles")
      .withIndex("by_tenant_name", (q) =>
        q.eq("tenantId", args.tenantId).eq("name", args.name),
      )
      .first();

    if (nameClash !== null) {
      throw new ConvexError({
        code: "CUSTOM_ROLE_NAME_TAKEN",
        message: `A custom role named "${args.name}" already exists in this tenant`,
        name: args.name,
      });
    }

    const now = Date.now();
    const id = await ctx.db.insert("customRoles", {
      tenantId: args.tenantId,
      name: args.name,
      permissions: args.permissions,
      description: args.description,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        timestamp: now,
        action: "custom_role_created",
        userId: args.createdBy,
        actorId: args.createdBy,
        details: {
          scope: undefined,
          customRoleId: id,
          customRoleName: args.name,
        },
      });
    }

    return id;
  },
});

/**
 * Update a custom role definition. Returns the new permission list so the
 * caller (action layer) can fan out `recomputeUser` over all users holding
 * this role.
 *
 * If neither `name`, `permissions`, nor `description` is provided, this is a
 * no-op (returns the current row).
 */
export const updateCustomRoleDefinition = mutation({
  args: {
    customRoleId: v.id("customRoles"),
    tenantId: v.string(),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    grantablePermissions: v.array(v.string()),
    actorId: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.object({
    permissions: v.array(v.string()),
    permissionsChanged: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.customRoleId);
    if (existing === null) {
      throw new ConvexError({
        code: "CUSTOM_ROLE_NOT_FOUND",
        message: "Custom role does not exist",
        customRoleId: args.customRoleId,
      });
    }
    if (existing.tenantId !== args.tenantId) {
      // Cross-tenant access attempt — treat as not-found to avoid leaking
      // the existence of roles from another tenant.
      throw new ConvexError({
        code: "CUSTOM_ROLE_NOT_FOUND",
        message: "Custom role does not exist",
        customRoleId: args.customRoleId,
      });
    }

    if (args.permissions !== undefined) {
      assertPermissionsGrantable(args.permissions, args.grantablePermissions);
    }

    if (args.name !== undefined && args.name !== existing.name) {
      if (args.name.trim().length === 0) {
        throw new ConvexError({
          code: "INVALID_CUSTOM_ROLE_NAME",
          message: "Custom role name must be a non-empty string",
        });
      }
      const clash = await ctx.db
        .query("customRoles")
        .withIndex("by_tenant_name", (q) =>
          q.eq("tenantId", args.tenantId).eq("name", args.name as string),
        )
        .first();
      if (clash !== null && clash._id !== existing._id) {
        throw new ConvexError({
          code: "CUSTOM_ROLE_NAME_TAKEN",
          message: `A custom role named "${args.name}" already exists in this tenant`,
          name: args.name,
        });
      }
    }

    const now = Date.now();
    const patch: Partial<{
      name: string;
      permissions: string[];
      description: string | undefined;
      updatedAt: number;
    }> = { updatedAt: now };
    if (args.name !== undefined) patch.name = args.name;
    if (args.permissions !== undefined) patch.permissions = args.permissions;
    if (args.description !== undefined) patch.description = args.description;

    await ctx.db.patch(args.customRoleId, patch);

    const newPermissions = args.permissions ?? existing.permissions;
    const permissionsChanged =
      args.permissions !== undefined &&
      !arraysEqualAsSets(existing.permissions, args.permissions);

    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        timestamp: now,
        action: "custom_role_updated",
        userId: args.actorId ?? existing.createdBy,
        actorId: args.actorId,
        details: {
          scope: undefined,
          customRoleId: args.customRoleId,
          customRoleName: args.name ?? existing.name,
        },
      });
    }

    return {
      permissions: newPermissions,
      permissionsChanged,
    };
  },
});

function arraysEqualAsSets(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

/**
 * Delete a custom role definition. Refuses if any user currently holds it
 * unless `force: true`, in which case all assignments and their materialized
 * rows in `effectiveRoles` / `effectivePermissions` are removed first.
 */
export const deleteCustomRole = mutation({
  args: {
    customRoleId: v.id("customRoles"),
    tenantId: v.string(),
    force: v.optional(v.boolean()),
    actorId: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.object({
    deleted: v.boolean(),
    assignmentsRevoked: v.number(),
    effectiveRolesRemoved: v.number(),
    effectivePermissionsRemoved: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.customRoleId);
    if (existing === null || existing.tenantId !== args.tenantId) {
      throw new ConvexError({
        code: "CUSTOM_ROLE_NOT_FOUND",
        message: "Custom role does not exist",
        customRoleId: args.customRoleId,
      });
    }

    const roleString = customRoleStringFromId(args.customRoleId);

    const assignments = await ctx.db
      .query("roleAssignments")
      .withIndex("by_tenant_role", (q) =>
        q.eq("tenantId", args.tenantId).eq("role", roleString),
      )
      .take(4000);

    if (assignments.length > 0 && args.force !== true) {
      throw new ConvexError({
        code: "CUSTOM_ROLE_IN_USE",
        message: `Custom role "${existing.name}" is assigned to ${assignments.length} user(s). Pass force: true to revoke and delete.`,
        assignmentCount: assignments.length,
      });
    }

    let effectiveRolesRemoved = 0;
    let effectivePermissionsRemoved = 0;

    for (const assignment of assignments) {
      // Source row
      await ctx.db.delete(assignment._id);

      // effectiveRoles rows for this user × this role
      const effRoles = await ctx.db
        .query("effectiveRoles")
        .withIndex("by_tenant_user", (q) =>
          q.eq("tenantId", args.tenantId).eq("userId", assignment.userId),
        )
        .take(4000);
      for (const er of effRoles) {
        if (er.role === roleString) {
          await ctx.db.delete(er._id);
          effectiveRolesRemoved++;
        }
      }

      // effectivePermissions rows that listed this role as a source
      const effPerms = await ctx.db
        .query("effectivePermissions")
        .withIndex("by_tenant_user", (q) =>
          q.eq("tenantId", args.tenantId).eq("userId", assignment.userId),
        )
        .take(4000);
      for (const ep of effPerms) {
        if (!ep.sources.includes(roleString)) continue;
        const remainingSources = ep.sources.filter((s) => s !== roleString);
        if (
          remainingSources.length === 0 &&
          ep.directGrant !== true &&
          ep.directDeny !== true
        ) {
          await ctx.db.delete(ep._id);
          effectivePermissionsRemoved++;
        } else if (remainingSources.length !== ep.sources.length) {
          await ctx.db.patch(ep._id, { sources: remainingSources });
        }
      }
    }

    await ctx.db.delete(args.customRoleId);

    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        timestamp: Date.now(),
        action: "custom_role_deleted",
        userId: args.actorId ?? existing.createdBy,
        actorId: args.actorId,
        details: {
          scope: undefined,
          customRoleId: args.customRoleId,
          customRoleName: existing.name,
        },
      });
    }

    return {
      deleted: true,
      assignmentsRevoked: assignments.length,
      effectiveRolesRemoved,
      effectivePermissionsRemoved,
    };
  },
});

/**
 * List custom roles for a tenant (paginated).
 */
export const listCustomRoles = query({
  args: {
    tenantId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(customRoleDocValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("customRoles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .paginate(args.paginationOpts);
    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Fetch a single custom role by id, verifying tenant ownership.
 * Returns null if the role does not exist or belongs to a different tenant.
 */
export const getCustomRole = query({
  args: {
    customRoleId: v.id("customRoles"),
    tenantId: v.string(),
  },
  returns: v.union(customRoleDocValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.customRoleId);
    if (row === null || row.tenantId !== args.tenantId) {
      return null;
    }
    return row;
  },
});

/**
 * Fetch a single custom role by tenant + name (the human-readable lookup).
 */
export const getCustomRoleByName = query({
  args: {
    tenantId: v.string(),
    name: v.string(),
  },
  returns: v.union(customRoleDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customRoles")
      .withIndex("by_tenant_name", (q) =>
        q.eq("tenantId", args.tenantId).eq("name", args.name),
      )
      .first();
  },
});

/**
 * Internal helper used by `assignCustomRoleUnified` to fetch the snapshot
 * permission list. Returns null if the role does not exist in the given tenant.
 */
export const getCustomRolePermissions = query({
  args: {
    customRoleId: v.id("customRoles"),
    tenantId: v.string(),
  },
  returns: v.union(
    v.object({
      permissions: v.array(v.string()),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.customRoleId);
    if (row === null || row.tenantId !== args.tenantId) {
      return null;
    }
    return { permissions: row.permissions, name: row.name };
  },
});

/**
 * Count custom roles in a tenant — useful for admin UIs and the
 * `maxRolesPerTenant` cap check (already enforced inside `createCustomRole`).
 */
export const countCustomRoles = query({
  args: {
    tenantId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("customRoles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(DEFAULT_MAX_ROLES_PER_TENANT * 2);
    return rows.length;
  },
});
