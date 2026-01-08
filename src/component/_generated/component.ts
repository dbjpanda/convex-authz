/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    indexed: {
      addRelationWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          inheritedRelations?: Array<{
            fromObjectType: string;
            fromRelation: string;
            relation: string;
          }>;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        string,
        Name
      >;
      assignRoleWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          assignedBy?: string;
          expiresAt?: number;
          role: string;
          rolePermissions: Array<string>;
          scope?: { id: string; type: string };
          userId: string;
        },
        string,
        Name
      >;
      checkPermissionFast: FunctionReference<
        "query",
        "internal",
        {
          objectId?: string;
          objectType?: string;
          permission: string;
          userId: string;
        },
        boolean,
        Name
      >;
      cleanupExpired: FunctionReference<
        "mutation",
        "internal",
        {},
        { expiredPermissions: number; expiredRoles: number },
        Name
      >;
      denyPermissionDirect: FunctionReference<
        "mutation",
        "internal",
        {
          deniedBy?: string;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string,
        Name
      >;
      getUserPermissionsFast: FunctionReference<
        "query",
        "internal",
        { scopeKey?: string; userId: string },
        Array<{
          effect: string;
          permission: string;
          scopeKey: string;
          sources: Array<string>;
        }>,
        Name
      >;
      getUserRolesFast: FunctionReference<
        "query",
        "internal",
        { scopeKey?: string; userId: string },
        Array<{
          role: string;
          scope?: { id: string; type: string };
          scopeKey: string;
        }>,
        Name
      >;
      grantPermissionDirect: FunctionReference<
        "mutation",
        "internal",
        {
          expiresAt?: number;
          grantedBy?: string;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string,
        Name
      >;
      hasRelationFast: FunctionReference<
        "query",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean,
        Name
      >;
      hasRoleFast: FunctionReference<
        "query",
        "internal",
        {
          objectId?: string;
          objectType?: string;
          role: string;
          userId: string;
        },
        boolean,
        Name
      >;
      removeRelationWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean,
        Name
      >;
      revokeRoleWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          role: string;
          rolePermissions: Array<string>;
          scope?: { id: string; type: string };
          userId: string;
        },
        boolean,
        Name
      >;
    };
    mutations: {
      assignRole: FunctionReference<
        "mutation",
        "internal",
        {
          assignedBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          metadata?: any;
          role: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string,
        Name
      >;
      cleanupExpired: FunctionReference<
        "mutation",
        "internal",
        {},
        { expiredOverrides: number; expiredRoles: number },
        Name
      >;
      denyPermission: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string,
        Name
      >;
      grantPermission: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string,
        Name
      >;
      logPermissionCheck: FunctionReference<
        "mutation",
        "internal",
        {
          permission: string;
          reason?: string;
          result: boolean;
          scope?: { id: string; type: string };
          userId: string;
        },
        null,
        Name
      >;
      removeAllAttributes: FunctionReference<
        "mutation",
        "internal",
        { enableAudit?: boolean; removedBy?: string; userId: string },
        number,
        Name
      >;
      removeAttribute: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          key: string;
          removedBy?: string;
          userId: string;
        },
        boolean,
        Name
      >;
      removePermissionOverride: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          permission: string;
          removedBy?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        boolean,
        Name
      >;
      revokeAllRoles: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        number,
        Name
      >;
      revokeRole: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          role: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        boolean,
        Name
      >;
      setAttribute: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          key: string;
          setBy?: string;
          userId: string;
          value: any;
        },
        string,
        Name
      >;
    };
    queries: {
      checkPermission: FunctionReference<
        "query",
        "internal",
        {
          permission: string;
          rolePermissions: Record<string, Array<string>>;
          scope?: { id: string; type: string };
          userId: string;
        },
        {
          allowed: boolean;
          matchedOverride?: string;
          matchedRole?: string;
          reason: string;
        },
        Name
      >;
      getAuditLog: FunctionReference<
        "query",
        "internal",
        {
          action?:
            | "permission_check"
            | "role_assigned"
            | "role_revoked"
            | "permission_granted"
            | "permission_denied"
            | "attribute_set"
            | "attribute_removed";
          limit?: number;
          userId?: string;
        },
        Array<{
          _id: string;
          action: string;
          actorId?: string;
          details: any;
          timestamp: number;
          userId: string;
        }>,
        Name
      >;
      getEffectivePermissions: FunctionReference<
        "query",
        "internal",
        {
          rolePermissions: Record<string, Array<string>>;
          scope?: { id: string; type: string };
          userId: string;
        },
        {
          deniedPermissions: Array<string>;
          permissions: Array<string>;
          roles: Array<string>;
        },
        Name
      >;
      getPermissionOverrides: FunctionReference<
        "query",
        "internal",
        { permission?: string; userId: string },
        Array<{
          _id: string;
          effect: "allow" | "deny";
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
        }>,
        Name
      >;
      getUserAttribute: FunctionReference<
        "query",
        "internal",
        { key: string; userId: string },
        null | any,
        Name
      >;
      getUserAttributes: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{ _id: string; key: string; value: any }>,
        Name
      >;
      getUserRoles: FunctionReference<
        "query",
        "internal",
        { scope?: { id: string; type: string }; userId: string },
        Array<{
          _id: string;
          expiresAt?: number;
          metadata?: any;
          role: string;
          scope?: { id: string; type: string };
        }>,
        Name
      >;
      getUsersWithRole: FunctionReference<
        "query",
        "internal",
        { role: string; scope?: { id: string; type: string } },
        Array<{ assignedAt: number; expiresAt?: number; userId: string }>,
        Name
      >;
      hasRole: FunctionReference<
        "query",
        "internal",
        { role: string; scope?: { id: string; type: string }; userId: string },
        boolean,
        Name
      >;
    };
    rebac: {
      addRelation: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        string,
        Name
      >;
      checkRelationWithTraversal: FunctionReference<
        "query",
        "internal",
        {
          maxDepth?: number;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
          traversalRules?: any;
        },
        { allowed: boolean; path: Array<string>; reason: string },
        Name
      >;
      getObjectRelations: FunctionReference<
        "query",
        "internal",
        { objectId: string; objectType: string; relation?: string },
        Array<{
          _id: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        }>,
        Name
      >;
      getSubjectRelations: FunctionReference<
        "query",
        "internal",
        { objectType?: string; subjectId: string; subjectType: string },
        Array<{
          _id: string;
          objectId: string;
          objectType: string;
          relation: string;
        }>,
        Name
      >;
      hasDirectRelation: FunctionReference<
        "query",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean,
        Name
      >;
      listAccessibleObjects: FunctionReference<
        "query",
        "internal",
        {
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
          traversalRules?: any;
        },
        Array<{ objectId: string; via: string }>,
        Name
      >;
      listUsersWithAccess: FunctionReference<
        "query",
        "internal",
        { objectId: string; objectType: string; relation: string },
        Array<{ userId: string; via: string }>,
        Name
      >;
      removeRelation: FunctionReference<
        "mutation",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean,
        Name
      >;
    };
  };
