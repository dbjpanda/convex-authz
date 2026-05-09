/**
 * App Queries and Mutations for the Demo UI
 *
 * These functions provide data for the frontend dashboard.
 */

import { mutation, query, action } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import {
  Authz,
  definePermissions,
  defineRoles,
  type CustomRoleId,
} from "@djpanda/convex-authz";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { DEMO_ROLES } from "./constants.js";

// Define permissions and roles
const permissions = definePermissions({
  documents: { create: true, read: true, update: true, delete: true },
  settings: { view: true, manage: true },
  users: { invite: true, remove: true, manage: true },
  billing: { view: true, manage: true },
});

const roles = defineRoles(permissions, {
  admin: {
    documents: ["create", "read", "update", "delete"],
    settings: ["view", "manage"],
    users: ["invite", "remove", "manage"],
    billing: ["view", "manage"],
  },
  editor: {
    documents: ["create", "read", "update"],
    settings: ["view"],
  },
  viewer: {
    documents: ["read"],
    settings: ["view"],
  },
  billing_admin: {
    billing: ["view", "manage"],
    settings: ["view"],
  },
});

// Whitelist of permissions that tenant admins are allowed to compose into
// custom roles. The SaaS provider owns this list — typing it `as const` makes
// each entry participate in the PermissionArg<P> type, so typos are caught
// at compile time. `documents:delete` is intentionally excluded to demonstrate
// that tenant admins cannot escalate beyond what the provider permits.
const CUSTOM_ROLE_GRANTABLE_PERMISSIONS = [
  "documents:create",
  "documents:read",
  "documents:update",
  "settings:view",
  "users:invite",
  "billing:view",
] as const;

const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: "example",
  customRoles: {
    enabled: true,
    grantablePermissions: CUSTOM_ROLE_GRANTABLE_PERMISSIONS,
    maxRolesPerTenant: 50,
  },
});

// ============================================================================
// Queries
// ============================================================================

export const listUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.string(),
      avatar: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const listOrgs = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("orgs"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("orgs").collect();
  },
});

export const listDocuments = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      _creationTime: v.number(),
      title: v.string(),
      content: v.optional(v.string()),
      orgId: v.id("orgs"),
      authorId: v.id("users"),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("documents").collect();
  },
});

export const getUserWithRoles = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        name: v.string(),
        email: v.string(),
        avatar: v.optional(v.string()),
      }),
      roles: v.array(
        v.object({
          role: v.string(),
          scope: v.optional(v.object({ type: v.string(), id: v.string() })),
          scopeKey: v.string(),
        })
      ),
      orgs: v.array(
        v.object({
          _id: v.id("orgs"),
          name: v.string(),
          slug: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const roles = await authz.getUserRoles(ctx, String(args.userId));

    // Get user's orgs
    const memberships = await ctx.db
      .query("org_members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.orgId);
        return org
          ? { _id: org._id, name: org.name, slug: org.slug }
          : null;
      })
    );

    return {
      user,
      roles,
      orgs: orgs.filter((o): o is NonNullable<typeof o> => o !== null),
    };
  },
});

export const getRoleDefinitions = query({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      label: v.string(),
      description: v.string(),
      permissions: v.array(v.string()),
    })
  ),
  handler: async () => {
    return Object.entries(DEMO_ROLES).map(([name, role]) => ({
      name,
      label: role.label,
      description: role.description,
      permissions: [...role.permissions],
    }));
  },
});

export const getStats = query({
  args: {},
  returns: v.object({
    users: v.number(),
    orgs: v.number(),
    documents: v.number(),
    roleAssignments: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const orgs = await ctx.db.query("orgs").collect();
    const documents = await ctx.db.query("documents").collect();

    // Count role assignments — just show user count to avoid N+1 query overhead
    return {
      users: users.length,
      orgs: orgs.length,
      documents: documents.length,
      roleAssignments: users.length, // approximate — actual count requires per-user query
    };
  },
});

// ============================================================================
// Permission Checking
// ============================================================================

export const checkPermission = query({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    return await authz.can(ctx, String(args.userId), args.permission as any, scope);
  },
});

/** Used by @djpanda/convex-authz React hooks (useCanUser). Accepts string userId and optional scope. */
export const checkPermissionScoped = query({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await authz.can(ctx, args.userId, args.permission as any, args.scope);
  },
});

/** Used by @djpanda/convex-authz React hooks (useUserRoles). Returns roles array. */
export const getRoles = query({
  args: {
    userId: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  returns: v.array(
    v.object({
      role: v.string(),
      scope: v.optional(v.object({ type: v.string(), id: v.string() })),
      scopeKey: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await authz.getUserRoles(ctx, args.userId, args.scope);
  },
});

export const checkAllPermissions = query({
  args: {
    userId: v.id("users"),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.record(v.string(), v.boolean()),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;

    const perms = [
      "documents:create",
      "documents:read",
      "documents:update",
      "documents:delete",
      "settings:view",
      "settings:manage",
      "users:invite",
      "users:remove",
      "users:manage",
      "billing:view",
      "billing:manage",
    ] as const;

    const results: Record<string, boolean> = {};
    for (const perm of perms) {
      results[perm] = await authz.can(ctx, String(args.userId), perm, scope);
    }

    return results;
  },
});

// ============================================================================
// Mutations
// ============================================================================

export const assignRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    // Cast to any to allow dynamic role names from UI
    return await authz.assignRole(
      ctx,
      String(args.userId),
      args.role as keyof typeof roles,
      scope
    );
  },
});

export const revokeRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    // Cast to any to allow dynamic role names from UI
    return await authz.revokeRole(
      ctx,
      String(args.userId),
      args.role as keyof typeof roles,
      scope
    );
  },
});

export const grantPermission = mutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    return await authz.grantPermission(
      ctx,
      String(args.userId),
      args.permission as any,
      scope
    );
  },
});

export const denyPermission = mutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    return await authz.denyPermission(
      ctx,
      String(args.userId),
      args.permission as any,
      scope
    );
  },
});

/**
 * Remove a permission override (grant or deny) for a user. The third symmetric
 * counterpart to grantPermission / denyPermission — see Authz.removeOverride.
 */
export const removeOverride = mutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    return await authz.removeOverride(
      ctx,
      String(args.userId),
      args.permission as any,
      scope,
    );
  },
});

// ============================================================================
// Custom Roles (issue #31) — tenant admins compose roles at runtime
// ============================================================================

/** The whitelist exposed to the UI so it can render which permissions are grantable. */
export const getCustomRoleGrantablePermissions = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return [...CUSTOM_ROLE_GRANTABLE_PERMISSIONS];
  },
});

export const listCustomRoles = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      permissions: v.array(v.string()),
      createdBy: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const result = await authz.listCustomRoles(ctx, {
      numItems: 100,
      cursor: null,
    });
    return result.page.map((r) => ({
      _id: r._id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

export const createCustomRole = mutation({
  args: {
    name: v.string(),
    permissions: v.array(v.string()),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return await authz.createCustomRole(ctx, {
      name: args.name,
      permissions: args.permissions as Array<
        (typeof CUSTOM_ROLE_GRANTABLE_PERMISSIONS)[number]
      >,
      description: args.description,
      createdBy: String(args.createdBy),
    });
  },
});

export const updateCustomRole = action({
  args: {
    customRoleId: v.string(),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
  },
  returns: v.object({
    permissionsChanged: v.boolean(),
    usersRecomputed: v.number(),
  }),
  handler: async (ctx, args) => {
    return await authz.updateCustomRole(ctx, {
      customRoleId: args.customRoleId as CustomRoleId,
      name: args.name,
      permissions: args.permissions as
        | Array<(typeof CUSTOM_ROLE_GRANTABLE_PERMISSIONS)[number]>
        | undefined,
      description: args.description,
      actorId: args.actorId ? String(args.actorId) : undefined,
    });
  },
});

export const deleteCustomRole = mutation({
  args: {
    customRoleId: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    deleted: v.boolean(),
    assignmentsRevoked: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await authz.deleteCustomRole(ctx, {
      customRoleId: args.customRoleId as CustomRoleId,
      force: args.force,
    });
    return {
      deleted: result.deleted,
      assignmentsRevoked: result.assignmentsRevoked,
    };
  },
});

export const assignCustomRole = mutation({
  args: {
    userId: v.id("users"),
    customRoleId: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    return await authz.assignCustomRole(
      ctx,
      String(args.userId),
      args.customRoleId as CustomRoleId,
      scope,
    );
  },
});

export const revokeCustomRole = mutation({
  args: {
    userId: v.id("users"),
    customRoleId: v.string(),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const scope = args.orgId
      ? { type: "org", id: String(args.orgId) }
      : undefined;
    return await authz.revokeCustomRole(
      ctx,
      String(args.userId),
      args.customRoleId as CustomRoleId,
      scope,
    );
  },
});
