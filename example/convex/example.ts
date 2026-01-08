/**
 * Example usage of @convex-dev/authz
 *
 * This file demonstrates how to use the authz component in your Convex app.
 */
import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { v } from "convex/values";
import { Auth } from "convex/server";

// ============================================================================
// Step 1: Define your permissions
// ============================================================================
const permissions = definePermissions({
  documents: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  settings: {
    view: true,
    manage: true,
  },
});

// ============================================================================
// Step 2: Define roles with their permissions
// ============================================================================
const roles = defineRoles(permissions, {
  admin: {
    documents: ["create", "read", "update", "delete"],
    settings: ["view", "manage"],
  },
  editor: {
    documents: ["create", "read", "update"],
    settings: ["view"],
  },
  viewer: {
    documents: ["read"],
  },
});

// ============================================================================
// Step 3: Create the authz client
// ============================================================================
const authz = new Authz(components.authz, {
  permissions,
  roles,
});

// ============================================================================
// Example: Permission check in a mutation
// ============================================================================
export const updateDocument = mutation({
  args: { docId: v.string(), content: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Require permission (throws if denied)
    await authz.require(ctx, userId, "documents:update");

    // Your update logic here...
    console.log(`User ${userId} updated document ${args.docId}`);

    return { success: true };
  },
});

// ============================================================================
// Example: Boolean permission check
// ============================================================================
export const canEdit = query({
  args: { docId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await authz.can(ctx, userId, "documents:update");
  },
});

// ============================================================================
// Example: Scoped permission check
// ============================================================================
export const canEditInTeam = query({
  args: { docId: v.string(), teamId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await authz.can(ctx, userId, "documents:update", {
      type: "team",
      id: args.teamId,
    });
  },
});

// ============================================================================
// Example: Assign a role
// ============================================================================
export const assignEditorRole = mutation({
  args: { targetUserId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);

    // Only admins can assign roles
    await authz.require(ctx, actorId, "settings:manage");

    return await authz.assignRole(
      ctx,
      args.targetUserId,
      "editor",
      undefined, // global scope
      undefined, // no expiration
      actorId
    );
  },
});

// ============================================================================
// Example: Get user roles
// ============================================================================
export const getUserRoles = query({
  args: { targetUserId: v.string() },
  returns: v.array(
    v.object({
      _id: v.string(),
      role: v.string(),
      scope: v.optional(v.object({ type: v.string(), id: v.string() })),
      metadata: v.optional(v.any()),
      expiresAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    return await authz.getUserRoles(ctx, args.targetUserId);
  },
});

// ============================================================================
// Example: Set user attribute (for ABAC)
// ============================================================================
export const setDepartment = mutation({
  args: { targetUserId: v.string(), department: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    await authz.require(ctx, actorId, "settings:manage");

    return await authz.setAttribute(
      ctx,
      args.targetUserId,
      "department",
      args.department,
      actorId
    );
  },
});

// ============================================================================
// Helper function to get authenticated user ID
// ============================================================================
async function getAuthUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: User must be authenticated");
  }
  return identity.subject;
}
