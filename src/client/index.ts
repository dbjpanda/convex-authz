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
 * export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
 * ```
 */

import { ConvexError } from "convex/values";
import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";
import {
  validateTenantId,
  validateUserId,
  validatePermission,
  validateScope,
  validateRole,
  validateOptionalExpiresAt,
  validateAttributeKey,
  validateAuditLimit,
  validateRelationArgs,
  validatePermissions,
  validateRoleAssignItems,
  validateRoles,
  type RoleAssignItem,
  type RoleScopeItem,
} from "./validation.js";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Permission definition structure
 * Maps resource names to action names
 */
export type PermissionDefinition = Record<string, Record<string, boolean>>;

/**
 * Derive all valid "resource:action" permission strings from a PermissionDefinition.
 * E.g., `{ documents: { read: true, write: true } }` → `"documents:read" | "documents:write"`
 */
export type PermissionString<P extends PermissionDefinition> = {
  [R in keyof P & string]: {
    [A in keyof P[R] & string]: `${R}:${A}`;
  }[keyof P[R] & string];
}[keyof P & string];

/**
 * Extract all action names across all resources.
 * E.g., `{ documents: { read, write }, settings: { view } }` → `"read" | "write" | "view"`
 */
type AllActions<P extends PermissionDefinition> = {
  [R in keyof P]: keyof P[R] & string;
}[keyof P];

/**
 * Valid wildcard patterns derived from a PermissionDefinition.
 * - `"documents:*"` — all actions on a defined resource
 * - `"*:read"` — a defined action on all resources
 * - `"*"` — everything
 * - `"*:*"` — everything (alternative)
 */
type WildcardPermission<P extends PermissionDefinition> =
  | `${keyof P & string}:*`
  | `*:${AllActions<P>}`
  | "*"
  | "*:*";

/**
 * Type-safe permission argument: accepts concrete "resource:action" strings
 * from the permission definition, plus wildcard patterns.
 * Catches typos like "documets:read" or "documents:reed" at compile time.
 *
 * Also accepts `string & {}` as a fallback for dynamic permission strings
 * (e.g., from Convex function args). This preserves autocomplete for
 * literal strings while allowing runtime-determined values.
 */
export type PermissionArg<P extends PermissionDefinition> =
  | PermissionString<P>
  | WildcardPermission<P>;

/** Reserved keys in role definitions; do not use as permission resource names. */
const RESERVED_ROLE_KEYS = ["inherits", "includes"] as const;

/**
 * Role definition structure
 * Maps role names to their granted permissions.
 * Roles may optionally inherit one role (`inherits`) and/or include multiple roles (`includes`).
 * Effective permissions are the union of inherited/included and direct permissions.
 */
export type RoleDefinition<P extends PermissionDefinition> = Record<
  string,
  {
    inherits?: string;
    includes?: readonly string[];
  } & { [K in keyof P]?: ReadonlyArray<keyof P[K]> }
>;

/**
 * Policy definition for ABAC
 * Condition may be sync or async (e.g. for DB or API checks).
 * The optional `type` field classifies the policy as "static" (default) or "deferred".
 */
export type PolicyDefinition = Record<
  string,
  {
    type?: "static" | "deferred"; // default: "static"
    condition: (ctx: PolicyContext) => boolean | Promise<boolean>;
    message?: string;
  }
>;

/**
 * Rules for traversing relations between entity types.
 * Each key is a source entity type; its value is an array of traversal hops.
 */
export type TraversalRules = Record<
  string,
  Array<{
    through: string;
    via: string;
    inherit: string;
  }>
>;

/**
 * Maps relation names to the permission strings they grant.
 */
export type RelationPermissionMap = Record<string, string[]>;

/**
 * A caveat function that adds extra conditions to a permission check.
 * Returns `true` when the permission should be granted, `false` to deny.
 */
export type CaveatFunction = (context: {
  subject: { type: string; id: string };
  object: { type: string; id: string };
  relation: string;
  caveatContext: unknown;
}) => boolean | Promise<boolean>;

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
  environment?: {
    timestamp: number;
    ip?: string;
  };
  hasRole: (role: string) => boolean;
  hasAttribute: (key: string) => boolean;
  getAttribute: <T = unknown>(key: string, defaultValue?: T) => T | undefined;
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
 * Define type-safe permissions.
 *
 * Pass a single object to define permissions from scratch, or pass
 * multiple objects to merge them together. Later entries add new
 * resources and actions; overlapping resources are merged.
 *
 * @example
 * ```ts
 * // Single definition
 * const permissions = definePermissions({
 *   documents: { create: true, read: true, update: true, delete: true },
 * });
 *
 * // Merge component defaults with app-specific resources
 * import { TENANTS_PERMISSIONS } from "@djpanda/convex-tenants";
 * const permissions = definePermissions(TENANTS_PERMISSIONS, {
 *   billing: { manage: true, view: true },
 * });
 * ```
 */
export function definePermissions<P extends PermissionDefinition>(p: P): P;
export function definePermissions<
  P1 extends PermissionDefinition,
  P2 extends PermissionDefinition,
>(p1: P1, p2: P2): P1 & P2;
export function definePermissions<
  P1 extends PermissionDefinition,
  P2 extends PermissionDefinition,
  P3 extends PermissionDefinition,
>(p1: P1, p2: P2, p3: P3): P1 & P2 & P3;
export function definePermissions(
  ...definitions: PermissionDefinition[]
): PermissionDefinition {
  if (definitions.length === 1) return definitions[0];
  const result: Record<string, Record<string, boolean>> = {};
  for (const def of definitions) {
    for (const [resource, actions] of Object.entries(def)) {
      result[resource] = { ...(result[resource] ?? {}), ...actions };
    }
  }
  return result;
}

/**
 * Define type-safe roles based on permissions.
 *
 * The first argument is the permissions definition (for type inference).
 * Pass a single role object, or pass multiple role objects to merge them.
 * For existing roles, permission arrays are concatenated (deduplicated).
 * New roles from later objects are added as-is.
 *
 * @example
 * ```ts
 * // Single definition
 * const roles = defineRoles(permissions, {
 *   admin: { documents: ["create", "read", "update", "delete"] },
 *   viewer: { documents: ["read"] },
 * });
 *
 * // Merge component defaults with app-specific extensions
 * import { TENANTS_ROLES } from "@djpanda/convex-tenants";
 * const roles = defineRoles(permissions, TENANTS_ROLES, {
 *   owner: { billing: ["manage", "view"] },     // extend existing role
 *   billing_admin: { billing: ["manage"] },      // add new role
 * });
 * ```
 */
export function defineRoles<
  P extends PermissionDefinition,
  R extends RoleDefinition<P>,
>(permissions: P, roles: R): R;
export function defineRoles<
  P extends PermissionDefinition,
  R1 extends RoleDefinition<P>,
  R2 extends RoleDefinition<P>,
>(permissions: P, r1: R1, r2: R2): R1 & R2;
export function defineRoles<
  P extends PermissionDefinition,
  R1 extends RoleDefinition<P>,
  R2 extends RoleDefinition<P>,
  R3 extends RoleDefinition<P>,
>(permissions: P, r1: R1, r2: R2, r3: R3): R1 & R2 & R3;
export function defineRoles<P extends PermissionDefinition>(
  _permissions: P,
  ...roleDefs: RoleDefinition<P>[]
): RoleDefinition<P> {
  if (roleDefs.length === 1) return roleDefs[0];
  const result: Record<string, Record<string, unknown>> = {};
  for (const def of roleDefs) {
    for (const [roleName, rolePerms] of Object.entries(def)) {
      const r = rolePerms as Record<string, unknown>;
      if (!result[roleName]) {
        result[roleName] = { ...r };
      } else {
        const existing = result[roleName] as Record<string, unknown>;
        if (r.inherits !== undefined) existing.inherits = r.inherits;
        if (Array.isArray(r.includes)) {
          const prev = (existing.includes as string[] | undefined) ?? [];
          existing.includes = [...new Set([...prev, ...r.includes])];
        }
        for (const [key, value] of Object.entries(r)) {
          if (RESERVED_ROLE_KEYS.includes(key as (typeof RESERVED_ROLE_KEYS)[number]))
            continue;
          const existingArr = (existing[key] ?? []) as string[];
          const incomingArr = Array.isArray(value) ? (value as string[]) : [];
          existing[key] = [...new Set([...existingArr, ...incomingArr])];
        }
      }
    }
  }
  return result as RoleDefinition<P>;
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
 * Evaluate a policy condition (sync or async). Always returns a Promise so callers can await uniformly.
 */
export function evaluatePolicyCondition(
  condition: (ctx: PolicyContext) => boolean | Promise<boolean>,
  ctx: PolicyContext
): Promise<boolean> {
  try {
    return Promise.resolve(condition(ctx)).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Resolve effective permissions for a role, following inherits and includes with cycle detection.
 * @internal
 */
function resolveRolePermissions(
  roles: Record<string, Record<string, unknown>>,
  roleName: string,
  visited: Set<string>
): string[] {
  if (!Object.prototype.hasOwnProperty.call(roles, roleName)) return [];
  if (visited.has(roleName)) {
    throw new Error(
      `Role inheritance cycle detected involving role "${roleName}"`
    );
  }
  visited.add(roleName);
  const rolePerms = roles[roleName];
  const perms = new Set<string>();

  try {
    const inherits = rolePerms.inherits;
    if (inherits !== undefined && inherits !== null) {
      const ref = String(inherits);
      if (!Object.prototype.hasOwnProperty.call(roles, ref)) {
        throw new Error(
          `Role "${roleName}" inherits unknown role "${ref}"`
        );
      }
      for (const p of resolveRolePermissions(roles, ref, visited)) perms.add(p);
    }
    const includes = rolePerms.includes;
    if (Array.isArray(includes)) {
      for (const ref of includes) {
        const r = String(ref);
        if (!Object.prototype.hasOwnProperty.call(roles, r)) {
          throw new Error(
            `Role "${roleName}" includes unknown role "${r}"`
          );
        }
        for (const p of resolveRolePermissions(roles, r, visited)) perms.add(p);
      }
    }
    for (const [resource, actions] of Object.entries(rolePerms)) {
      if (
        RESERVED_ROLE_KEYS.includes(resource as (typeof RESERVED_ROLE_KEYS)[number])
      )
        continue;
      if (Array.isArray(actions)) {
        for (const action of actions) perms.add(`${resource}:${String(action)}`);
      }
    }
    return [...perms];
  } finally {
    visited.delete(roleName);
  }
}

/**
 * Flatten role permissions into an array of permission strings.
 * Resolves inheritance (`inherits`) and composition (`includes`) so that
 * effective permissions include those from inherited/included roles.
 */
export function flattenRolePermissions(
  roles: Record<string, Record<string, unknown>>,
  roleName: string
): string[] {
  const visited = new Set<string>();
  return resolveRolePermissions(roles, roleName, visited);
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
 * const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
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
      tenantId: string;
      // v2:
      relationPermissions?: RelationPermissionMap;
    }
  ) {
    validateTenantId(options.tenantId);
  }

  withTenant(tenantId: string): Authz<P, R, Policy> {
    validateTenantId(tenantId);
    return new Authz(this.component, { ...this.options, tenantId });
  }

  /**
   * Build role permissions map for queries
   */
  private buildRolePermissionsMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const roles = this.options.roles as unknown as Record<string, Record<string, string[]>>;

    for (const roleName of Object.keys(roles)) {
      map[roleName] = flattenRolePermissions(roles, roleName);
    }

    return map;
  }

  /**
   * Internal helper: check permission via the unified O(1) indexed path.
   * Returns the full structured result including tier and policyName for deferred evaluation.
   */
  private async _checkPermission(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: string,
    scope?: Scope,
  ): Promise<{ allowed: boolean; reason: string; tier: string; policyName?: string }> {
    validateUserId(userId);
    validatePermission(permission);
    validateScope(scope);
    return ctx.runQuery(this.component.unified.checkPermission, {
      tenantId: this.options.tenantId,
      userId,
      permission,
      scope,
    });
  }

  /**
   * Internal helper: evaluate a deferred policy condition.
   * Fetches user attributes and roles, builds a PolicyContext, and evaluates the condition.
   */
  private async _evaluateDeferredPolicy(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    policyName: string | undefined,
    permission: string,
    scope?: Scope,
    requestContext?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!policyName || !this.options.policies) return false;
    const policy = (this.options.policies as Record<string, { condition: (ctx: PolicyContext) => boolean | Promise<boolean> }>)[policyName];
    if (!policy) return false;

    // Fetch user attributes and roles for the context
    const [attrs, roles] = await Promise.all([
      ctx.runQuery(this.component.queries.getUserAttributes, {
        userId,
        tenantId: this.options.tenantId,
      }),
      ctx.runQuery(this.component.queries.getUserRoles, {
        userId,
        scope,
        tenantId: this.options.tenantId,
      }),
    ]);

    const roleNames = roles.map((r: { role: string }) => r.role);
    const attrMap = Object.fromEntries(attrs.map((a: { key: string; value: unknown }) => [a.key, a.value]));

    const policyCtx: PolicyContext = {
      subject: {
        userId,
        roles: roleNames,
        attributes: attrMap,
      },
      resource: scope ? { type: scope.type, id: scope.id, ...requestContext } : requestContext ? { type: "", id: "", ...requestContext } : undefined,
      action: permission,
      environment: { timestamp: Date.now() },
      hasRole: (role: string) => roleNames.includes(role),
      hasAttribute: (key: string) => key in attrMap,
      getAttribute: <T = unknown>(key: string, defaultValue?: T) => (attrMap[key] as T) ?? defaultValue,
    };

    return evaluatePolicyCondition(policy.condition, policyCtx);
  }

  /**
   * Check if user has permission.
   * Uses O(1) indexed lookup via the unified checkPermission query.
   * Permission checks support wildcard matching: if the user has a role or override with a pattern
   * (e.g. "documents:*", "*:read", or "*"), it is treated as granting that permission when the
   * pattern matches the requested permission.
   * @param permission - Concrete permission "resource:action" (e.g. "documents:read")
   */
  async can(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: PermissionArg<P>,
    scope?: Scope
  ): Promise<boolean> {
    const result = await this._checkPermission(ctx, userId, permission, scope);
    if (!result.allowed) return false;
    // For deferred policies, evaluate with empty context
    if (result.tier === "deferred" && this.options.policies) {
      return this._evaluateDeferredPolicy(ctx, userId, result.policyName, permission, scope);
    }
    return true;
  }

  /**
   * Check if user has permission, with additional request context for deferred policy evaluation.
   * Uses O(1) indexed lookup via the unified checkPermission query.
   * @param permission - Concrete permission "resource:action" (e.g. "documents:read")
   * @param requestContext - Additional context passed to deferred policy conditions
   */
  async canWithContext(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: PermissionArg<P>,
    scope?: Scope,
    requestContext?: Record<string, unknown>,
  ): Promise<boolean> {
    const result = await this._checkPermission(ctx, userId, permission, scope);
    if (!result.allowed) return false;
    if (result.tier === "deferred" && this.options.policies) {
      return this._evaluateDeferredPolicy(ctx, userId, result.policyName, permission, scope, requestContext);
    }
    return true;
  }

  /**
   * Require permission or throw error.
   * Supports the same wildcard matching as {@link Authz.can}.
   * @param permission - Concrete permission "resource:action" (e.g. "documents:read")
   */
  async require(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permission: PermissionArg<P>,
    scope?: Scope
  ): Promise<void> {
    const allowed = await this.can(ctx, userId, permission, scope);
    if (!allowed) {
      // ConvexError (not plain Error) so the rejection is classified as an
      // expected, structured failure on the client side instead of an
      // "Uncaught Error / Server Error" with internal stack trace exposed.
      // Consumers can catch and pattern-match on `.data.code === "FORBIDDEN"`.
      throw new ConvexError({
        code: "FORBIDDEN",
        message: `Permission denied: ${permission}${scope ? ` on ${scope.type}:${scope.id}` : ""}`,
        permission: String(permission),
        scopeType: scope?.type ?? null,
        scopeId: scope?.id ?? null,
      });
    }
  }

  /**
   * Check if user has any of the given permissions (canAny).
   * Returns true if the user is allowed at least one of the permissions in the given scope.
   * @param permissions - Array of permission strings (e.g. ["documents:read", "documents:update"]). Max length 100.
   */
  async canAny(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    permissions: PermissionArg<P>[],
    scope?: Scope
  ): Promise<boolean> {
    validateUserId(userId);
    validatePermissions(permissions as string[]);
    validateScope(scope);
    for (const perm of permissions) {
      if (await this.can(ctx, userId, perm, scope)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has a role - O(1) indexed lookup
   */
  async hasRole(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope
  ): Promise<boolean> {
    validateUserId(userId);
    validateRole(role, this.options.roles);
    validateScope(scope);
    return await ctx.runQuery(this.component.indexed.hasRoleFast, {
      userId,
      role,
      objectType: scope?.type,
      objectId: scope?.id,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Get all roles for a user - O(1) indexed lookup
   */
  async getUserRoles(ctx: QueryCtx | ActionCtx, userId: string, scope?: Scope) {
    validateUserId(userId);
    validateScope(scope);
    const scopeKey = scope ? `${scope.type}:${scope.id}` : undefined;
    return await ctx.runQuery(this.component.indexed.getUserRolesFast, {
      userId,
      scopeKey,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Get all effective permissions for a user - O(1) indexed lookup
   */
  async getUserPermissions(
    ctx: QueryCtx | ActionCtx,
    userId: string,
    scope?: Scope
  ) {
    validateUserId(userId);
    validateScope(scope);
    const scopeKey = scope ? `${scope.type}:${scope.id}` : undefined;
    return await ctx.runQuery(this.component.indexed.getUserPermissionsFast, {
      userId,
      scopeKey,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Get all attributes for a user
   */
  async getUserAttributes(ctx: QueryCtx | ActionCtx, userId: string) {
    validateUserId(userId);
    return await ctx.runQuery(this.component.queries.getUserAttributes, {
      userId,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Assign a role to a user (unified: writes to both source tables and indexed tables)
   */
  async assignRole(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope,
    expiresAt?: number,
    actorId?: string
  ): Promise<string> {
    validateUserId(userId);
    validateRole(role, this.options.roles);
    validateScope(scope);
    validateOptionalExpiresAt(expiresAt);
    const rolePermissions = flattenRolePermissions(
      this.options.roles as unknown as Record<string, Record<string, string[]>>,
      role
    );
    // Build policy classifications for permissions being assigned
    // Static policies (type: "static" or undefined) are classified as "deferred" because
    // we cannot evaluate them at assignment time without user context (MutationCtx lacks runQuery).
    // They will be properly evaluated at read time in can().
    const policyClassifications: Record<string, "deferred" | "allow" | "deny" | null> = {};
    if (this.options.policies) {
      for (const perm of rolePermissions) {
        const policy = (this.options.policies as Record<string, { type?: string }>)[perm];
        if (policy) {
          policyClassifications[perm] = "deferred";
        }
      }
    }
    return await ctx.runMutation(this.component.unified.assignRoleUnified, {
      tenantId: this.options.tenantId,
      userId,
      role,
      rolePermissions,
      scope,
      expiresAt,
      assignedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
      policyClassifications: Object.keys(policyClassifications).length > 0 ? policyClassifications : undefined,
    });
  }

  /**
   * Revoke a role from a user (unified: updates both source tables and indexed tables)
   */
  async revokeRole(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    role: keyof R & string,
    scope?: Scope,
    actorId?: string
  ): Promise<boolean> {
    validateUserId(userId);
    validateRole(role, this.options.roles);
    validateScope(scope);
    const rolePermissions = flattenRolePermissions(
      this.options.roles as unknown as Record<string, Record<string, string[]>>,
      role
    );
    return await ctx.runMutation(this.component.unified.revokeRoleUnified, {
      tenantId: this.options.tenantId,
      userId,
      role,
      rolePermissions,
      scope,
      revokedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
    });
  }

  /**
   * Assign multiple roles to a user in a single transaction.
   * @param roles - Array of { role, scope?, expiresAt?, metadata? }. Max length 100.
   */
  async assignRoles(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    roles: RoleAssignItem[],
    actorId?: string
  ): Promise<{ assigned: number; assignmentIds: string[] }> {
    validateUserId(userId);
    validateRoleAssignItems(roles, this.options.roles);
    const assignedBy = actorId ?? this.options.defaultActorId;
    // Build policy classifications from all permissions across all roles being assigned
    // All policies (static and deferred) are classified as "deferred" because
    // we cannot evaluate static policies at assignment time without user context.
    const policyClassifications: Record<string, "deferred" | "allow" | "deny" | null> = {};
    if (this.options.policies) {
      const rolePermissionsMap = this.buildRolePermissionsMap();
      for (const r of roles) {
        const perms = rolePermissionsMap[r.role] ?? [];
        for (const perm of perms) {
          const policy = (this.options.policies as Record<string, { type?: string }>)[perm];
          if (policy) {
            policyClassifications[perm] = "deferred";
          }
        }
      }
    }
    return ctx.runMutation(this.component.unified.assignRolesUnified, {
      userId,
      roles: roles.map((r) => ({
        role: r.role,
        scope: r.scope,
        expiresAt: r.expiresAt,
        metadata: r.metadata,
      })),
      rolePermissionsMap: this.buildRolePermissionsMap(),
      assignedBy,
      enableAudit: true,
      tenantId: this.options.tenantId,
      policyClassifications: Object.keys(policyClassifications).length > 0 ? policyClassifications : undefined,
    });
  }

  /**
   * Revoke multiple roles from a user in a single transaction.
   * @param roles - Array of { role, scope? }. Max length 100.
   */
  async revokeRoles(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    roles: RoleScopeItem[],
    actorId?: string
  ): Promise<{ revoked: number }> {
    validateUserId(userId);
    validateRoles(roles, this.options.roles);
    return ctx.runMutation(this.component.unified.revokeRolesUnified, {
      userId,
      roles: roles.map((r) => ({ role: r.role, scope: r.scope })),
      rolePermissionsMap: this.buildRolePermissionsMap(),
      revokedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Revoke all roles from a user (optionally only in a given scope).
   * Use for bulk cleanup or partial offboarding.
   */
  async revokeAllRoles(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    scope?: Scope,
    actorId?: string
  ): Promise<number> {
    validateUserId(userId);
    validateScope(scope);
    return ctx.runMutation(this.component.unified.revokeAllRolesUnified, {
      userId,
      scope,
      rolePermissionsMap: this.buildRolePermissionsMap(),
      revokedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Full user offboarding: remove all roles, permission overrides, attributes, and optionally
   * ReBAC relationships for the user (optionally scoped). Also clears indexed
   * effectiveRoles/effectivePermissions/effectiveRelationships when present.
   */
  async offboardUser(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    options?: {
      scope?: Scope;
      actorId?: string;
      removeAttributes?: boolean;
      removeOverrides?: boolean;
      removeRelationships?: boolean;
    }
  ): Promise<{
    rolesRevoked: number;
    overridesRemoved: number;
    attributesRemoved: number;
    relationshipsRemoved: number;
    effectiveRolesRemoved: number;
    effectivePermissionsRemoved: number;
    effectiveRelationshipsRemoved: number;
  }> {
    validateUserId(userId);
    if (options?.scope) validateScope(options.scope);
    return await ctx.runMutation(this.component.mutations.offboardUser, {
      userId,
      scope: options?.scope,
      revokedBy: options?.actorId ?? this.options.defaultActorId,
      removeAttributes: options?.removeAttributes,
      removeOverrides: options?.removeOverrides,
      removeRelationships: options?.removeRelationships,
      enableAudit: true,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Full user deprovisioning: wipes all roles, attributes, relationships, and permission
   * overrides for a given userId in one atomic call. Use for security incident response,
   * enterprise offboarding, or single-button deactivation.
   */
  async deprovisionUser(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    options?: { actorId?: string; enableAudit?: boolean }
  ): Promise<{
    rolesRevoked: number;
    overridesRemoved: number;
    attributesRemoved: number;
    relationshipsRemoved: number;
    effectiveRolesRemoved: number;
    effectivePermissionsRemoved: number;
    effectiveRelationshipsRemoved: number;
  }> {
    validateUserId(userId);
    return await ctx.runMutation(this.component.mutations.deprovisionUser, {
      userId,
      revokedBy: options?.actorId ?? this.options.defaultActorId,
      enableAudit: options?.enableAudit ?? true,
      tenantId: this.options.tenantId,
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
    validateUserId(userId);
    validateAttributeKey(key);
    return await ctx.runMutation(this.component.unified.setAttributeWithRecompute, {
      tenantId: this.options.tenantId,
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
    validateUserId(userId);
    validateAttributeKey(key);
    const result = await ctx.runMutation(this.component.mutations.removeAttribute, {
      userId,
      key,
      removedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
      tenantId: this.options.tenantId,
    });
    // Trigger policy re-evaluation after attribute removal (policies may depend on this attribute)
    // All policies are classified as "deferred" so they are re-evaluated at read time.
    if (this.options.policies && Object.keys(this.options.policies).length > 0) {
      const policyClassifications: Record<string, "deferred" | "allow" | "deny" | null> = {};
      for (const [name] of Object.entries(this.options.policies as Record<string, { type?: string }>)) {
        policyClassifications[name] = "deferred";
      }
      await ctx.runMutation(this.component.unified.recomputeUser, {
        tenantId: this.options.tenantId,
        userId,
        rolePermissionsMap: this.buildRolePermissionsMap(),
        policyClassifications,
      });
    }
    return result;
  }

  /**
   * Grant a direct permission override (unified: writes to both source tables and indexed tables).
   * Permission can be a concrete permission ("documents:read") or a wildcard pattern
   * ("documents:*", "*:read", "*:*", or "*") to allow all matching permissions.
   * @param permission - Permission or pattern (e.g. "documents:read", "documents:*", "*:read", "*")
   */
  async grantPermission(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    permission: PermissionArg<P>,
    scope?: Scope,
    reason?: string,
    expiresAt?: number,
    actorId?: string
  ): Promise<string> {
    validateUserId(userId);
    validatePermission(permission);
    validateScope(scope);
    validateOptionalExpiresAt(expiresAt);
    return await ctx.runMutation(this.component.unified.grantPermissionUnified, {
      tenantId: this.options.tenantId,
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
   * Deny a permission (explicit deny override, unified: writes to both source tables and indexed tables).
   * Permission can be a concrete permission or a wildcard pattern (e.g. "documents:*", "*:read", "*").
   * @param permission - Permission or pattern to deny
   */
  async denyPermission(
    ctx: MutationCtx | ActionCtx,
    userId: string,
    permission: PermissionArg<P>,
    scope?: Scope,
    reason?: string,
    expiresAt?: number,
    actorId?: string
  ): Promise<string> {
    validateUserId(userId);
    validatePermission(permission);
    validateScope(scope);
    validateOptionalExpiresAt(expiresAt);
    return await ctx.runMutation(this.component.unified.denyPermissionUnified, {
      tenantId: this.options.tenantId,
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
   * Check relationship - O(1) indexed lookup
   */
  async hasRelation(
    ctx: QueryCtx | ActionCtx,
    subject: { type: string; id: string },
    relation: string,
    object: { type: string; id: string },
  ): Promise<boolean> {
    return ctx.runQuery(this.component.indexed.hasRelationFast, {
      subjectType: subject.type,
      subjectId: subject.id,
      relation,
      objectType: object.type,
      objectId: object.id,
      tenantId: this.options.tenantId,
    });
  }

  /**
   * Add a relationship (unified: writes to both source tables and indexed tables)
   */
  async addRelation(
    ctx: MutationCtx | ActionCtx,
    subject: { type: string; id: string },
    relation: string,
    object: { type: string; id: string },
    options?: { caveat?: string; caveatContext?: unknown; createdBy?: string },
  ): Promise<string> {
    validateRelationArgs(subject.type, subject.id, relation, object.type, object.id);
    return ctx.runMutation(this.component.unified.addRelationUnified, {
      subjectType: subject.type,
      subjectId: subject.id,
      relation,
      objectType: object.type,
      objectId: object.id,
      caveat: options?.caveat,
      caveatContext: options?.caveatContext,
      createdBy: options?.createdBy ?? this.options.defaultActorId,
      enableAudit: true,
      tenantId: this.options.tenantId,
      relationPermissions: this.options.relationPermissions,
    });
  }

  /**
   * Remove a relationship (unified: removes from both source tables and indexed tables)
   */
  async removeRelation(
    ctx: MutationCtx | ActionCtx,
    subject: { type: string; id: string },
    relation: string,
    object: { type: string; id: string },
    actorId?: string,
  ): Promise<boolean> {
    validateRelationArgs(subject.type, subject.id, relation, object.type, object.id);
    return ctx.runMutation(this.component.unified.removeRelationUnified, {
      subjectType: subject.type,
      subjectId: subject.id,
      relation,
      objectType: object.type,
      objectId: object.id,
      removedBy: actorId ?? this.options.defaultActorId,
      enableAudit: true,
      tenantId: this.options.tenantId,
      relationPermissions: this.options.relationPermissions,
    });
  }

  /**
   * Build policy classifications from the configured policies. All policies
   * are classified as "deferred" so they are re-evaluated at read time.
   * Returns `undefined` when no policies are configured (matches the
   * optional argument shape on the component-side mutations).
   */
  private buildPolicyClassifications():
    | Record<string, "deferred" | "allow" | "deny" | null>
    | undefined {
    if (!this.options.policies) return undefined;
    const entries = Object.entries(
      this.options.policies as Record<string, { type?: string }>,
    );
    if (entries.length === 0) return undefined;
    const map: Record<string, "deferred" | "allow" | "deny" | null> = {};
    for (const [name] of entries) {
      map[name] = "deferred";
    }
    return map;
  }

  /**
   * Recompute all indexed data for a user (effectiveRoles, effectivePermissions).
   * Useful when role definitions change and you need to rebuild the index.
   */
  async recomputeUser(ctx: MutationCtx | ActionCtx, userId: string): Promise<void> {
    validateUserId(userId);
    await ctx.runMutation(this.component.unified.recomputeUser, {
      tenantId: this.options.tenantId,
      userId,
      rolePermissionsMap: this.buildRolePermissionsMap(),
      policyClassifications: this.buildPolicyClassifications(),
    });
  }

  /**
   * Re-materialize permissions for every user holding the given role.
   *
   * Use after a role definition (`defineRoles(...)`) gains or loses
   * permissions and you redeploy. Existing assignments still carry the old
   * materialized rows in `effectivePermissions`; this rebuilds them from the
   * current role definition while preserving direct grants/denies.
   *
   * Requires an action context — internally pages through assignments and
   * runs `recomputeUser` per user. Each user is one mutation transaction;
   * a partial failure leaves earlier users updated and stops on the failing
   * one (rerun is safe and idempotent).
   *
   * @param role - Role name from the configured catalog. Type-checked.
   * @returns Number of unique users recomputed.
   */
  async syncRole<RoleName extends keyof R & string>(
    ctx: ActionCtx,
    role: RoleName,
  ): Promise<{ usersProcessed: number }> {
    const roles = this.options.roles as unknown as Record<string, unknown>;
    if (!(role in roles)) {
      throw new Error(`Role "${String(role)}" not found in role catalog`);
    }
    return await ctx.runAction(this.component.unified.syncRoleAction, {
      tenantId: this.options.tenantId,
      role,
      rolePermissionsMap: this.buildRolePermissionsMap(),
      policyClassifications: this.buildPolicyClassifications(),
    });
  }

  /**
   * Re-materialize permissions for every user holding any role in the
   * configured catalog. Convenience wrapper around `syncRole` that iterates
   * across all roles.
   *
   * Cost is roughly `(unique users with any role) × (one mutation each)`.
   * For a full deploy-time sync of a 10k-user app, expect tens of seconds.
   * For very large user bases, prefer running per-role syncs in parallel
   * (each `syncRole` call is independent).
   */
  async syncRoles(
    ctx: ActionCtx,
  ): Promise<{ rolesProcessed: number; usersProcessed: number }> {
    const rolePermissionsMap = this.buildRolePermissionsMap();
    const policyClassifications = this.buildPolicyClassifications();
    const roles = Object.keys(rolePermissionsMap);

    let totalUsers = 0;
    for (const role of roles) {
      const result = await ctx.runAction(
        this.component.unified.syncRoleAction,
        {
          tenantId: this.options.tenantId,
          role,
          rolePermissionsMap,
          policyClassifications,
        },
      );
      totalUsers += result.usersProcessed;
    }
    return { rolesProcessed: roles.length, usersProcessed: totalUsers };
  }

  /**
   * Get audit log entries.
   * Pass cursor and numItems for cursor-based pagination (returns { page, isDone, continueCursor }).
   * Omit both for legacy behavior (returns array, optional limit).
   */
  async getAuditLog(
    ctx: QueryCtx | ActionCtx,
    options?: {
      userId?: string;
      action?: string;
      limit?: number;
      /** Page size when using pagination (1–1000). Use with cursor for next page. */
      numItems?: number;
      /** Cursor from previous page to fetch next page. */
      cursor?: string | null;
    }
  ): Promise<
    | Array<{
        _id: string;
        timestamp: number;
        action: string;
        userId: string;
        actorId?: string;
        details: unknown;
      }>
    | {
        page: Array<{
          _id: string;
          timestamp: number;
          action: string;
          userId: string;
          actorId?: string;
          details: unknown;
        }>;
        isDone: boolean;
        continueCursor: string;
      }
  > {
    if (options?.userId !== undefined) validateUserId(options.userId);
    if (options?.limit !== undefined) validateAuditLimit(options.limit);
    if (options?.numItems !== undefined) validateAuditLimit(options.numItems);

    const usePagination =
      options?.numItems !== undefined || options?.cursor !== undefined;

    const paginationOpts = usePagination
      ? {
          numItems: options?.numItems ?? 100,
          cursor: options?.cursor ?? null,
        }
      : undefined;

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
        | "relation_added"
        | "relation_removed"
        | "policy_evaluated"
        | undefined,
      limit: options?.limit,
      paginationOpts,
      tenantId: this.options.tenantId,
    });
  }
}

// ============================================================================
// v2 Definition Helpers
// ============================================================================

/**
 * Define traversal rules for ReBAC relation-graph walks.
 * This is a type-safe identity helper — it returns the value unchanged.
 *
 * @example
 * ```ts
 * const traversalRules = defineTraversalRules({
 *   user: [{ through: "member", via: "group", inherit: "viewer" }],
 * });
 * ```
 */
export function defineTraversalRules(rules: TraversalRules): TraversalRules {
  return rules;
}

/**
 * Define a map from relation names to the permission strings they grant.
 * This is a type-safe identity helper — it returns the value unchanged.
 *
 * @example
 * ```ts
 * const relationPermissions = defineRelationPermissions({
 *   owner: ["documents:read", "documents:write"],
 *   viewer: ["documents:read"],
 * });
 * ```
 */
export function defineRelationPermissions(
  map: RelationPermissionMap
): RelationPermissionMap {
  return map;
}

/**
 * Define named caveat functions for fine-grained permission conditions.
 * This is a type-safe identity helper — it returns the value unchanged.
 *
 * @example
 * ```ts
 * const caveats = defineCaveats({
 *   isOwner: ({ subject, object }) => subject.id === object.id,
 * });
 * ```
 */
export function defineCaveats(
  caveats: Record<string, CaveatFunction>
): Record<string, CaveatFunction> {
  return caveats;
}

// ============================================================================
// Re-exports
// ============================================================================

export type { ComponentApi } from "../component/_generated/component.js";
export type { RoleAssignItem, RoleScopeItem } from "./validation.js";

/**
 * Check if a concrete permission matches a permission pattern (supports wildcards).
 * Use this for client-side logic when you need to test whether a stored pattern
 * would grant a given permission.
 *
 * Patterns:
 * - `"*"` matches every permission
 * - `"resource:*"` matches all actions on that resource (e.g. `"documents:*"` matches `documents:read`, `documents:write`)
 * - `"*:action"` matches that action on any resource (e.g. `"*:read"` matches `documents:read`, `settings:read`)
 * - `"*:*"` matches every permission
 *
 * @example
 * ```ts
 * import { matchesPermissionPattern } from "@djpanda/convex-authz";
 * matchesPermissionPattern("documents:read", "documents:*"); // true
 * matchesPermissionPattern("documents:read", "*:read");     // true
 * matchesPermissionPattern("documents:write", "*:read");   // false
 * ```
 */
export {
  matchesPermissionPattern,
  parsePermission,
  buildPermission,
} from "../component/helpers.js";
