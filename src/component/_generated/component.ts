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
 * Scope type for resource-level permissions
 */
type Scope = { type: string; id: string };

/**
 * A utility for referencing the Authz component's exposed API.
 *
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.queries.checkPermission, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    queries: {
      getUserRoles: FunctionReference<
        "query",
        "public",
        { userId: string; scope?: Scope },
        Array<{
          _id: string;
          role: string;
          scope?: Scope;
          metadata?: any;
          expiresAt?: number;
        }>,
        Name
      >;
      hasRole: FunctionReference<
        "query",
        "public",
        { userId: string; role: string; scope?: Scope },
        boolean,
        Name
      >;
      getUserAttributes: FunctionReference<
        "query",
        "public",
        { userId: string },
        Array<{ _id: string; key: string; value: any }>,
        Name
      >;
      getUserAttribute: FunctionReference<
        "query",
        "public",
        { userId: string; key: string },
        any,
        Name
      >;
      getPermissionOverrides: FunctionReference<
        "query",
        "public",
        { userId: string; permission?: string },
        Array<{
          _id: string;
          permission: string;
          effect: "allow" | "deny";
          scope?: Scope;
          reason?: string;
          expiresAt?: number;
        }>,
        Name
      >;
      checkPermission: FunctionReference<
        "query",
        "public",
        {
          userId: string;
          permission: string;
          scope?: Scope;
          rolePermissions: Record<string, string[]>;
        },
        {
          allowed: boolean;
          reason: string;
          matchedRole?: string;
          matchedOverride?: string;
        },
        Name
      >;
      getEffectivePermissions: FunctionReference<
        "query",
        "public",
        {
          userId: string;
          rolePermissions: Record<string, string[]>;
          scope?: Scope;
        },
        {
          permissions: string[];
          roles: string[];
          deniedPermissions: string[];
        },
        Name
      >;
      getUsersWithRole: FunctionReference<
        "query",
        "public",
        { role: string; scope?: Scope },
        Array<{ userId: string; assignedAt: number; expiresAt?: number }>,
        Name
      >;
      getAuditLog: FunctionReference<
        "query",
        "public",
        {
          userId?: string;
          action?:
            | "permission_check"
            | "role_assigned"
            | "role_revoked"
            | "permission_granted"
            | "permission_denied"
            | "attribute_set"
            | "attribute_removed";
          limit?: number;
        },
        Array<{
          _id: string;
          timestamp: number;
          action: string;
          userId: string;
          actorId?: string;
          details: any;
        }>,
        Name
      >;
    };
    mutations: {
      assignRole: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          role: string;
          scope?: Scope;
          metadata?: any;
          assignedBy?: string;
          expiresAt?: number;
          enableAudit?: boolean;
        },
        string,
        Name
      >;
      revokeRole: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          role: string;
          scope?: Scope;
          revokedBy?: string;
          enableAudit?: boolean;
        },
        boolean,
        Name
      >;
      revokeAllRoles: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          scope?: Scope;
          revokedBy?: string;
          enableAudit?: boolean;
        },
        number,
        Name
      >;
      setAttribute: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          key: string;
          value: any;
          setBy?: string;
          enableAudit?: boolean;
        },
        string,
        Name
      >;
      removeAttribute: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          key: string;
          removedBy?: string;
          enableAudit?: boolean;
        },
        boolean,
        Name
      >;
      removeAllAttributes: FunctionReference<
        "mutation",
        "public",
        { userId: string; removedBy?: string; enableAudit?: boolean },
        number,
        Name
      >;
      grantPermission: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          permission: string;
          scope?: Scope;
          reason?: string;
          createdBy?: string;
          expiresAt?: number;
          enableAudit?: boolean;
        },
        string,
        Name
      >;
      denyPermission: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          permission: string;
          scope?: Scope;
          reason?: string;
          createdBy?: string;
          expiresAt?: number;
          enableAudit?: boolean;
        },
        string,
        Name
      >;
      removePermissionOverride: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          permission: string;
          scope?: Scope;
          removedBy?: string;
          enableAudit?: boolean;
        },
        boolean,
        Name
      >;
      logPermissionCheck: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          permission: string;
          result: boolean;
          scope?: Scope;
          reason?: string;
        },
        null,
        Name
      >;
      cleanupExpired: FunctionReference<
        "mutation",
        "public",
        {},
        { expiredRoles: number; expiredOverrides: number },
        Name
      >;
    };
    indexed: {
      checkPermissionFast: FunctionReference<
        "query",
        "public",
        { userId: string; permission: string; objectType?: string; objectId?: string },
        boolean,
        Name
      >;
      hasRoleFast: FunctionReference<
        "query",
        "public",
        { userId: string; role: string; objectType?: string; objectId?: string },
        boolean,
        Name
      >;
      hasRelationFast: FunctionReference<
        "query",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
        },
        boolean,
        Name
      >;
      getUserPermissionsFast: FunctionReference<
        "query",
        "public",
        { userId: string; scopeKey?: string },
        Array<{ permission: string; effect: string; sources: string[] }>,
        Name
      >;
      getUserRolesFast: FunctionReference<
        "query",
        "public",
        { userId: string; scopeKey?: string },
        Array<{ role: string; scopeKey: string }>,
        Name
      >;
      assignRoleWithCompute: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          role: string;
          rolePermissions: string[];
          scope?: Scope;
          expiresAt?: number;
          assignedBy?: string;
        },
        string,
        Name
      >;
      revokeRoleWithCompute: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          role: string;
          rolePermissions: string[];
          scope?: Scope;
        },
        boolean,
        Name
      >;
      grantPermissionDirect: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          permission: string;
          scope?: Scope;
          reason?: string;
          grantedBy?: string;
          expiresAt?: number;
        },
        string,
        Name
      >;
      denyPermissionDirect: FunctionReference<
        "mutation",
        "public",
        {
          userId: string;
          permission: string;
          scope?: Scope;
          reason?: string;
          deniedBy?: string;
          expiresAt?: number;
        },
        string,
        Name
      >;
      addRelationWithCompute: FunctionReference<
        "mutation",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
          inheritedRelations?: Array<{
            relation: string;
            fromObjectType: string;
            fromRelation: string;
          }>;
          createdBy?: string;
        },
        string,
        Name
      >;
      removeRelationWithCompute: FunctionReference<
        "mutation",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
        },
        boolean,
        Name
      >;
    };
    rebac: {
      addRelation: FunctionReference<
        "mutation",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
          createdBy?: string;
        },
        string,
        Name
      >;
      removeRelation: FunctionReference<
        "mutation",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
        },
        boolean,
        Name
      >;
      hasDirectRelation: FunctionReference<
        "query",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
        },
        boolean,
        Name
      >;
      getSubjectRelations: FunctionReference<
        "query",
        "public",
        { subjectType: string; subjectId: string; relation?: string },
        Array<{
          _id: string;
          relation: string;
          objectType: string;
          objectId: string;
        }>,
        Name
      >;
      getObjectRelations: FunctionReference<
        "query",
        "public",
        { objectType: string; objectId: string; relation?: string },
        Array<{
          _id: string;
          subjectType: string;
          subjectId: string;
          relation: string;
        }>,
        Name
      >;
      checkRelationWithTraversal: FunctionReference<
        "query",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
          objectId: string;
          traversalRules: Record<
            string,
            Array<{ through: string; via: string; inherit: string }>
          >;
          maxDepth?: number;
        },
        { allowed: boolean; path?: string[]; reason?: string },
        Name
      >;
      listAccessibleObjects: FunctionReference<
        "query",
        "public",
        {
          subjectType: string;
          subjectId: string;
          relation: string;
          objectType: string;
        },
        Array<{ objectId: string }>,
        Name
      >;
      listUsersWithAccess: FunctionReference<
        "query",
        "public",
        { objectType: string; objectId: string; relation: string },
        Array<{ userId: string }>,
        Name
      >;
    };
  };
