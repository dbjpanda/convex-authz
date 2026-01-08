/**
 * App Queries and Mutations for the Demo UI
 *
 * These functions provide data for the frontend dashboard.
 */

import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { v } from "convex/values";
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

const authz = new Authz(components.authz, { permissions, roles });

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
          _id: v.string(),
          role: v.string(),
          scope: v.optional(v.object({ type: v.string(), id: v.string() })),
          expiresAt: v.optional(v.number()),
          metadata: v.optional(v.any()),
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

    // Count role assignments by querying authz for each user
    let roleAssignments = 0;
    for (const user of users) {
      const roles = await authz.getUserRoles(ctx, String(user._id));
      roleAssignments += roles.length;
    }

    return {
      users: users.length,
      orgs: orgs.length,
      documents: documents.length,
      roleAssignments,
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
    return await authz.can(ctx, String(args.userId), args.permission, scope);
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
      args.permission,
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
      args.permission,
      scope
    );
  },
});
