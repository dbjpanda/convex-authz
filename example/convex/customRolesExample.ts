/**
 * Example: tenant-admin-defined custom roles (issue #31)
 *
 * Demonstrates the full custom-roles flow:
 *   - SaaS provider configures a `grantablePermissions` whitelist
 *   - Tenant admin creates a custom role from that whitelist
 *   - Users get assigned the custom role
 *   - Permission checks use the same `can()` API
 *   - Tenant admin updates the role; all assigned users are re-materialized
 *   - Tenant admin deletes the role
 *
 * Run after `npm run build:codegen` so the customRoles component module is
 * registered in the example app.
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

// ──────────────────────────────────────────────────────────────────────────
// SaaS provider config: define permissions, system roles, and the whitelist
// ──────────────────────────────────────────────────────────────────────────

const permissions = definePermissions({
  documents: { create: true, read: true, update: true, delete: true },
  settings: { view: true, manage: true },
});

const systemRoles = defineRoles(permissions, {
  admin: {
    documents: ["create", "read", "update", "delete"],
    settings: ["view", "manage"],
  },
  viewer: { documents: ["read"] },
});

/**
 * The whitelist below is the security boundary: tenant admins can compose
 * any subset of these into a custom role, but they cannot introduce
 * permission strings outside this list. The `as const` keeps the entries
 * typed as `PermissionArg<P>` so typos like "documets:read" fail to
 * compile.
 */
const GRANTABLE_PERMISSIONS = [
  "documents:read",
  "documents:update",
  "documents:create",
  "settings:view",
] as const;

function makeAuthz(tenantId: string) {
  return new Authz(components.authz, {
    permissions,
    roles: systemRoles,
    tenantId,
    customRoles: {
      enabled: true,
      grantablePermissions: GRANTABLE_PERMISSIONS,
      maxRolesPerTenant: 50,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Tenant admin creates a custom role
// ──────────────────────────────────────────────────────────────────────────

export const createSeniorEditorRole = mutation({
  args: {
    tenantId: v.string(),
    actorId: v.string(),
  },
  returns: v.object({ customRoleId: v.string() }),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    const roleId = await authz.createCustomRole(ctx, {
      name: "Senior Editor",
      permissions: ["documents:read", "documents:update"],
      description: "Can edit but not delete or create documents",
      createdBy: args.actorId,
    });
    return { customRoleId: roleId };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// 2. Assign and revoke
// ──────────────────────────────────────────────────────────────────────────

export const assignSeniorEditor = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    customRoleId: v.string(),
    actorId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    return await authz.assignCustomRole(
      ctx,
      args.userId,
      args.customRoleId as CustomRoleId,
      undefined,
      undefined,
      args.actorId,
    );
  },
});

export const revokeSeniorEditor = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    customRoleId: v.string(),
    actorId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    return await authz.revokeCustomRole(
      ctx,
      args.userId,
      args.customRoleId as CustomRoleId,
      undefined,
      args.actorId,
    );
  },
});

// ──────────────────────────────────────────────────────────────────────────
// 3. Permission check — identical to system-role checks
// ──────────────────────────────────────────────────────────────────────────

export const canEditDocument = query({
  args: { tenantId: v.string(), userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    // can() doesn't care whether the permission came from a system role,
    // a custom role, or a direct grant — it reads effectivePermissions.
    return await authz.can(ctx, args.userId, "documents:update");
  },
});

// ──────────────────────────────────────────────────────────────────────────
// 4. Update (cascades to all assigned users via recomputeUser)
// ──────────────────────────────────────────────────────────────────────────

export const promoteSeniorEditorToCreator = action({
  args: {
    tenantId: v.string(),
    customRoleId: v.string(),
    actorId: v.string(),
  },
  returns: v.object({
    permissionsChanged: v.boolean(),
    usersRecomputed: v.number(),
  }),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    return await authz.updateCustomRole(ctx, {
      customRoleId: args.customRoleId as CustomRoleId,
      permissions: [
        "documents:read",
        "documents:update",
        "documents:create",
      ],
      actorId: args.actorId,
    });
  },
});

// ──────────────────────────────────────────────────────────────────────────
// 5. List + lookup
// ──────────────────────────────────────────────────────────────────────────

export const listTenantCustomRoles = query({
  args: { tenantId: v.string() },
  returns: v.array(
    v.object({
      _id: v.string(),
      name: v.string(),
      permissions: v.array(v.string()),
      description: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    const result = await authz.listCustomRoles(ctx, {
      numItems: 100,
      cursor: null,
    });
    return result.page.map((r) => ({
      _id: r._id,
      name: r.name,
      permissions: r.permissions,
      description: r.description,
    }));
  },
});

// ──────────────────────────────────────────────────────────────────────────
// 6. Delete (force: true revokes all assignments first)
// ──────────────────────────────────────────────────────────────────────────

export const deleteCustomRole = mutation({
  args: {
    tenantId: v.string(),
    customRoleId: v.string(),
    force: v.optional(v.boolean()),
    actorId: v.string(),
  },
  returns: v.object({
    deleted: v.boolean(),
    assignmentsRevoked: v.number(),
  }),
  handler: async (ctx, args) => {
    const authz = makeAuthz(args.tenantId);
    const result = await authz.deleteCustomRole(ctx, {
      customRoleId: args.customRoleId as CustomRoleId,
      force: args.force,
      actorId: args.actorId,
    });
    return {
      deleted: result.deleted,
      assignmentsRevoked: result.assignmentsRevoked,
    };
  },
});
