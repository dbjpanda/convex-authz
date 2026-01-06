import type { GenericQueryCtx, GenericDataModel } from "convex/server";

/**
 * Role hierarchy levels for comparison
 * Higher number = more permissions
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 100,
  admin: 80,
  manager: 60,
  editor: 40,
  viewer: 20,
  guest: 10,
};

/**
 * Check if a role assignment has expired
 */
export function isExpired(expiresAt: number | undefined | null): boolean {
  if (expiresAt === undefined || expiresAt === null) return false;
  return Date.now() > expiresAt;
}

/**
 * Get the hierarchy level of a role
 * Unknown roles default to level 0
 */
export function getRoleLevel(
  role: string,
  customHierarchy?: Record<string, number>
): number {
  const hierarchy = customHierarchy ?? ROLE_HIERARCHY;
  return hierarchy[role] ?? 0;
}

/**
 * Compare two roles and return which has higher permissions
 * Returns positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export function compareRoles(
  role1: string,
  role2: string,
  customHierarchy?: Record<string, number>
): number {
  return getRoleLevel(role1, customHierarchy) - getRoleLevel(role2, customHierarchy);
}

/**
 * Parse a permission string into resource and action parts
 * e.g., "documents:read" -> { resource: "documents", action: "read" }
 */
export function parsePermission(permission: string): {
  resource: string;
  action: string;
} {
  const parts = permission.split(":");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid permission format: "${permission}". Expected "resource:action"`
    );
  }
  return { resource: parts[0], action: parts[1] };
}

/**
 * Build a permission string from resource and action
 */
export function buildPermission(resource: string, action: string): string {
  return `${resource}:${action}`;
}

/**
 * Check if a permission matches a pattern (supports wildcards)
 * Patterns:
 * - "*" matches everything
 * - "documents:*" matches all document actions
 * - "*:read" matches read action on all resources
 */
export function matchesPermissionPattern(
  permission: string,
  pattern: string
): boolean {
  if (pattern === "*") return true;

  const { resource: permResource, action: permAction } = parsePermission(permission);
  const { resource: patResource, action: patAction } = parsePermission(pattern);

  const resourceMatch = patResource === "*" || patResource === permResource;
  const actionMatch = patAction === "*" || patAction === permAction;

  return resourceMatch && actionMatch;
}

/**
 * Scope matching for resource-level permissions
 */
export function matchesScope(
  scope: { type: string; id: string } | undefined,
  targetScope: { type: string; id: string } | undefined
): boolean {
  // No scope = global permission (matches everything)
  if (!scope) return true;
  // Target has no scope but permission is scoped = no match
  if (!targetScope) return false;
  // Both have scope, must match exactly
  return scope.type === targetScope.type && scope.id === targetScope.id;
}

/**
 * Role assignment type for helper functions
 */
interface RoleAssignment {
  role: string;
  scope?: { type: string; id: string };
  expiresAt?: number;
}

/**
 * Permission override type for helper functions
 */
interface PermissionOverride {
  permission: string;
  effect: "allow" | "deny";
  scope?: { type: string; id: string };
  expiresAt?: number;
}

/**
 * Check if any override applies to the given permission and scope
 * Returns: { allowed: boolean } if an override applies, null if no override
 */
export function checkOverrides(
  overrides: PermissionOverride[],
  permission: string,
  scope?: { type: string; id: string }
): { allowed: boolean } | null {
  // Check for explicit deny first (deny takes precedence)
  for (const override of overrides) {
    if (
      override.effect === "deny" &&
      matchesPermissionPattern(permission, override.permission) &&
      matchesScope(override.scope, scope)
    ) {
      return { allowed: false };
    }
  }

  // Then check for explicit allow
  for (const override of overrides) {
    if (
      override.effect === "allow" &&
      matchesPermissionPattern(permission, override.permission) &&
      matchesScope(override.scope, scope)
    ) {
      return { allowed: true };
    }
  }

  return null; // No override applies
}

/**
 * Resolve all effective permissions for a user based on their roles
 */
export function resolveRolePermissions(
  roles: string[],
  roleDefinitions: Record<string, string[]>
): Set<string> {
  const permissions = new Set<string>();

  for (const role of roles) {
    const rolePerms = roleDefinitions[role];
    if (rolePerms) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }
  }

  return permissions;
}

/**
 * Check if a set of permissions includes the requested permission
 * Supports wildcard matching
 */
export function hasPermissionInSet(
  permissions: Set<string>,
  requestedPermission: string
): boolean {
  // Direct match
  if (permissions.has(requestedPermission)) return true;

  // Wildcard match
  for (const perm of permissions) {
    if (matchesPermissionPattern(requestedPermission, perm)) {
      return true;
    }
  }

  return false;
}

/**
 * Policy evaluation context builder
 */
export interface PolicyContext {
  subject: {
    userId: string;
    roles: string[];
    attributes: Record<string, any>;
  };
  resource?: {
    type: string;
    id: string;
    attributes?: Record<string, any>;
  };
  action: string;
  environment: {
    timestamp: number;
    ip?: string;
  };
  hasRole: (role: string) => boolean;
  hasAttribute: (key: string) => boolean;
  getAttribute: <T = any>(key: string, defaultValue?: T) => T | undefined;
}

export function createPolicyContext(
  userId: string,
  roles: string[],
  userAttributes: Record<string, any>,
  action: string,
  resource?: { type: string; id: string; attributes?: Record<string, any> },
  environment?: { ip?: string }
): PolicyContext {
  return {
    subject: {
      userId,
      roles,
      attributes: userAttributes,
    },
    resource,
    action,
    environment: {
      timestamp: Date.now(),
      ip: environment?.ip,
    },
    hasRole: (role: string) => roles.includes(role),
    hasAttribute: (key: string) => key in userAttributes,
    getAttribute: <T = any>(key: string, defaultValue?: T) =>
      userAttributes[key] ?? defaultValue,
  };
}
