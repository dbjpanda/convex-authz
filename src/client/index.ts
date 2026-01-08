/**
 * @djpanda/convex-authz - Authorization Component for Convex
 *
 * A comprehensive RBAC/ABAC/ReBAC authorization component featuring
 * O(1) indexed lookups, inspired by Google Zanzibar.
 *
 * @example
 * ```typescript
 * import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
 * import { components } from "./_generated/api";
 *
 * const permissions = definePermissions({
 *   documents: { create: true, read: true, update: true, delete: true },
 * });
 *
 * const roles = defineRoles(permissions, {
 *   admin: { documents: ["create", "read", "update", "delete"] },
 *   viewer: { documents: ["read"] },
 * });
 *
 * export const authz = new Authz(components.authz, { permissions, roles });
 * ```
 */

import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Permission definition structure
 * Maps resource names to action names
 */
export type PermissionDefinition = Record<string, Record<string, boolean>>;

/**
 * Role definition structure
 * Maps role names to their granted permissions
 */
export type RoleDefinition<P extends PermissionDefinition> = Record<
  string,
  { [K in keyof P]?: Array<keyof P[K]> }
>;

/**
 * Policy definition for ABAC
 */
export type PolicyDefinition = Record<
  string,
  {
    condition: (ctx: PolicyContext) => boolean;
    message?: string;
  }
>;

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  subject: {
    userId: string;
    roles: string[];
    attributes: Record<string, unknown>;
  };
  resource?: {
    type: string;
    id: string;
    [key: string]: unknown;
  };
  action: string;
}

/**
 * Scope for resource-level permissions
 */
export interface Scope {
  type: string;
  id: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Define type-safe permissions
 */
export function definePermissions<P extends PermissionDefinition>(
  permissions: P
): P {
  return permissions;
}

/**
 * Define type-safe roles based on permissions
 */
export function defineRoles<
  P extends PermissionDefinition,
  R extends RoleDefinition<P>,
>(permissions: P, roles: R): R {
  return roles;
}

/**
 * Define ABAC policies
 */
export function definePolicies<Policy extends PolicyDefinition>(
  policies: Policy
): Policy {
  return policies;
}

/**
 * Flatten role permissions into an array of permission strings
 */
export function flattenRolePermissions(
  roles: Record<string, Record<string, string[]>>,
  roleName: string
): string[] {
  const rolePerms = roles[roleName];
  if (!rolePerms) return [];

  const permissions: string[] = [];
  for (const [resource, actions] of Object.entries(rolePerms)) {
    if (Array.isArray(actions)) {
      for (const action of actions) {
        permissions.push(`${resource}:${String(action)}`);
      }
    }
  }
  return permissions;
}

// ============================================================================
// Context Types for Client Methods
// ============================================================================

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<GenericMutationCtx<GenericDataModel>, "runMutation">;
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

// ============================================================================
// Authz Client Class (Standard)
// ============================================================================

/**
 * Standard Authz client for RBAC/ABAC operations
 *
 * @example
 * ```typescript
 * const authz = new Authz(components.authz, { permissions, roles });
 *
 * // In a mutation or query
 * const canEdit = await authz.can(ctx, userId, "documents:update");
 * await authz.require(ctx, userId, "documents:update");
 * ```
 */
export class Authz<
  P extends PermissionDefinition,
  R extends RoleDefinition<P>,
  Policy extends PolicyDefinition = Record<string, never>,
> {
  constructor(
    public component: ComponentApi,
    private options: {
      permissions: P;
      roles: R;
      policies?: Policy;
      defaultActorId?: string;
    }
  ) {}

  /**
   * Build role permissions map for queries
   */
  private buildRolePermissionsMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const roles = this.options.roles as Record<string, Record<string, string[]>>;

    for (const roleName of Object.keys(roles)) {
      map[roleName] = flattenRolePermissions(roles, roleName);
    }

    return map;
  }

  /**
   * Check if user has permission
   */
  async can(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope
  ): Promise<boolean> {
    const result = await ctx.runQuery(this.component.queries.checkPermission, {
      userId,
      permission,
      scope,
      rolePermissions: this.buildRolePermissionsMap(),
    });

    return result.allowed;
  }

  /**
   * Require permission or throw error
   */
  async require(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope
  ): Promise<void> {
    const result = await ctx.runQuery(this.component.queries.checkPermission, {
      userId,
      permission,
      scope,
      rolePermissions: this.buildRolePermissionsMap(),
    });

    if (!result.allowed) {
      throw new Error(
        `Permission denied: ${permission}${scope ? ` on ${scope.type}:${scope.id}` : ""} - ${result.reason}`
      );
    }
  }

  /**
   * Check if user has a role
   */
  async hasRole(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.queries.hasRole, {
      userId,
      role,
      scope,
    });
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(ctx: QueryCtx | ActionCtx, userId: string, scope?: Scope) {
    return await ctx.runQuery(this.component.queries.getUserRoles, {
      userId,
      scope,
    });
  }

  /**
   * Get all effective permissions for a user
   */
  async getUserPermissions(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    scope?: Scope
  ) {
    return await ctx.runQuery(this.component.queries.getEffectivePermissions, {
      userId,
      rolePermissions: this.buildRolePermissionsMap(),
      scope,
    });
  }

  /**
   * Get all attributes for a user
   */
  async getUserAttributes(ctx: QueryCtx | ActionCtx, userId: string) {
    return await ctx.runQuery(this.component.queries.getUserAttributes, {
      userId,
    });
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope,
    expiresAt?: number,
    actorId?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.mutations.assignRole, {
      userId,
      role,
      scope,
      expiresAt,
      assignedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope,
    actorId?: string
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.mutations.revokeRole, {
      userId,
      role,
      scope,
      revokedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Set a user attribute
   */
  async setAttribute(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    key: string,
    value: unknown,
    actorId?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.mutations.setAttribute, {
      userId,
      key,
      value,
      setBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Remove a user attribute
   */
  async removeAttribute(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    key: string,
    actorId?: string
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.mutations.removeAttribute, {
      userId,
      key,
      removedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Grant a direct permission override
   */
  async grantPermission(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope,
    reason?: string,
    expiresAt?: number,
    actorId?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.mutations.grantPermission, {
      userId,
      permission,
      scope,
      reason,
      expiresAt,
      createdBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Deny a permission (explicit deny override)
   */
  async denyPermission(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope,
    reason?: string,
    expiresAt?: number,
    actorId?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.mutations.denyPermission, {
      userId,
      permission,
      scope,
      reason,
      expiresAt,
      createdBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(
    ctx: QueryCtx | ActionCtx,
    options?: {
      userId?: string;
      action?: string;
      limit?: number;
    }
  ) {
    return await ctx.runQuery(this.component.queries.getAuditLog, {
      userId: options?.userId,
      action: options?.action as
        | "permission_check"
        | "role_assigned"
        | "role_revoked"
        | "permission_granted"
        | "permission_denied"
        | "attribute_set"
        | "attribute_removed"
        | undefined,
      limit: options?.limit,
    });
  }
}

// ============================================================================
// IndexedAuthz Client Class (O(1) Lookups)
// ============================================================================

/**
 * O(1) Indexed Authz client with pre-computed permissions
 *
 * Use this for production workloads with many permission checks.
 * Writes are slower but reads are instant via indexed lookups.
 *
 * @example
 * ```typescript
 * const authz = new IndexedAuthz(components.authz, { permissions, roles });
 *
 * // O(1) permission check
 * const canEdit = await authz.can(ctx, userId, "documents:update");
 * ```
 */
export class IndexedAuthz<
  P extends PermissionDefinition,
  R extends RoleDefinition<P>,
> {
  constructor(
    public component: ComponentApi,
    private options: {
      permissions: P;
      roles: R;
      defaultActorId?: string;
    }
  ) {}

  /**
   * Check permission - O(1) indexed lookup
   */
  async can(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.indexed.checkPermissionFast, {
      userId,
      permission,
      objectType: scope?.type,
      objectId: scope?.id,
    });
  }

  /**
   * Require permission or throw - O(1)
   */
  async require(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope
  ): Promise<void> {
    const allowed = await this.can(ctx, userId, permission, scope);
    if (!allowed) {
      throw new Error(
        `Permission denied: ${permission}${scope ? ` on ${scope.type}:${scope.id}` : ""}`
      );
    }
  }

  /**
   * Check role - O(1) indexed lookup
   */
  async hasRole(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.indexed.hasRoleFast, {
      userId,
      role,
      objectType: scope?.type,
      objectId: scope?.id,
    });
  }

  /**
   * Check relationship - O(1) indexed lookup
   */
  async hasRelation(
    ctx: QueryCtx | ActionCtx,
    subjectType: string,
    subjectId: string,
    relation: string,
    objectType: string,
    objectId: string
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.indexed.hasRelationFast, {
      subjectType,
      subjectId,
      relation,
      objectType,
      objectId,
    });
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    scope?: Scope
  ) {
    const scopeKey = scope ? `${scope.type}:${scope.id}` : undefined;
    return await ctx.runQuery(this.component.indexed.getUserPermissionsFast, {
      userId,
      scopeKey,
    });
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(ctx: QueryCtx | ActionCtx, userId: string, scope?: Scope) {
    const scopeKey = scope ? `${scope.type}:${scope.id}` : undefined;
    return await ctx.runQuery(this.component.indexed.getUserRolesFast, {
      userId,
      scopeKey,
    });
  }

  /**
   * Assign a role and pre-compute permissions
   */
  async assignRole(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    roleName: keyof R & string,
    scope?: Scope,
    expiresAt?: number,
    assignedBy?: string
  ): Promise<string> {
    const rolePermissions = flattenRolePermissions(
      this.options.roles as unknown as Record<string, Record<string, string[]>>,
      roleName
    );

    return await ctx.runMutation(this.component.indexed.assignRoleWithCompute, {
      userId,
      role: roleName,
      rolePermissions,
      scope,
      expiresAt,
      assignedBy: assignedBy ?? this.options.defaultActorId,
    });
  }

  /**
   * Revoke a role and recompute permissions
   */
  async revokeRole(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    roleName: keyof R & string,
    scope?: Scope
  ): Promise<boolean> {
    const rolePermissions = flattenRolePermissions(
      this.options.roles as unknown as Record<string, Record<string, string[]>>,
      roleName
    );

    return await ctx.runMutation(this.component.indexed.revokeRoleWithCompute, {
      userId,
      role: roleName,
      rolePermissions,
      scope,
    });
  }

  /**
   * Grant a direct permission
   */
  async grantPermission(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope,
    reason?: string,
    expiresAt?: number,
    grantedBy?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.indexed.grantPermissionDirect, {
      userId,
      permission,
      scope,
      reason,
      grantedBy: grantedBy ?? this.options.defaultActorId,
      expiresAt,
    });
  }

  /**
   * Deny a permission
   */
  async denyPermission(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope,
    reason?: string,
    expiresAt?: number,
    deniedBy?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.indexed.denyPermissionDirect, {
      userId,
      permission,
      scope,
      reason,
      deniedBy: deniedBy ?? this.options.defaultActorId,
      expiresAt,
    });
  }

  /**
   * Add a relationship with computed transitive relations
   */
  async addRelation(
    ctx: MutationCtx | ActionCtx,
    subjectType: string,
    subjectId: string,
    relation: string,
    objectType: string,
    objectId: string,
    inheritedRelations?: Array<{
      relation: string;
      fromObjectType: string;
      fromRelation: string;
    }>,
    createdBy?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.indexed.addRelationWithCompute, {
      subjectType,
      subjectId,
      relation,
      objectType,
      objectId,
      inheritedRelations,
      createdBy: createdBy ?? this.options.defaultActorId,
    });
  }

  /**
   * Remove a relationship
   */
  async removeRelation(
    ctx: MutationCtx | ActionCtx,
    subjectType: string,
    subjectId: string,
    relation: string,
    objectType: string,
    objectId: string
  ): Promise<boolean> {
    return await ctx.runMutation(
      this.component.indexed.removeRelationWithCompute,
      {
        subjectType,
        subjectId,
        relation,
        objectType,
        objectId,
      }
    );
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export type { ComponentApi } from "../component/_generated/component.js";
