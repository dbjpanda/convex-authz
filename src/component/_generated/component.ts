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
    cronSetup: {
      ensureCleanupCronRegistered: FunctionReference<
        "mutation",
        "internal",
        {},
        null,
        Name
      >;
    };
    indexed: {
      checkPermissionFast: FunctionReference<
        "query",
        "internal",
        {
          objectId?: string;
          objectType?: string;
          permission: string;
          tenantId: string;
          userId: string;
        },
        boolean,
        Name
      >;
      checkPermissionsFast: FunctionReference<
        "query",
        "internal",
        {
          objectId?: string;
          objectType?: string;
          permissions: Array<string>;
          tenantId: string;
          userId: string;
        },
        boolean,
        Name
      >;
      cleanupExpired: FunctionReference<
        "mutation",
        "internal",
        { tenantId?: string },
        { expiredPermissions: number; expiredRoles: number },
        Name
      >;
      getUserPermissionsFast: FunctionReference<
        "query",
        "internal",
        { scopeKey?: string; tenantId: string; userId: string },
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
        { scopeKey?: string; tenantId: string; userId: string },
        Array<{
          role: string;
          scope?: { id: string; type: string };
          scopeKey: string;
        }>,
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
          tenantId: string;
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
          tenantId: string;
          userId: string;
        },
        boolean,
        Name
      >;
    };
    mutations: {
      cleanupExpired: FunctionReference<
        "mutation",
        "internal",
        { tenantId?: string },
        { expiredOverrides: number; expiredRoles: number },
        Name
      >;
      deprovisionUser: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          tenantId: string;
          userId: string;
        },
        {
          attributesRemoved: number;
          effectivePermissionsRemoved: number;
          effectiveRelationshipsRemoved: number;
          effectiveRolesRemoved: number;
          overridesRemoved: number;
          relationshipsRemoved: number;
          rolesRevoked: number;
        },
        Name
      >;
      offboardUser: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          removeAttributes?: boolean;
          removeOverrides?: boolean;
          removeRelationships?: boolean;
          revokedBy?: string;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        {
          attributesRemoved: number;
          effectivePermissionsRemoved: number;
          effectiveRelationshipsRemoved: number;
          effectiveRolesRemoved: number;
          overridesRemoved: number;
          relationshipsRemoved: number;
          rolesRevoked: number;
        },
        Name
      >;
      removeAttribute: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          key: string;
          removedBy?: string;
          tenantId: string;
          userId: string;
        },
        boolean,
        Name
      >;
      runAuditRetentionCleanup: FunctionReference<
        "mutation",
        "internal",
        { maxAgeDays?: number; maxEntries?: number; tenantId?: string },
        { deletedByAge: number; deletedByCount: number },
        Name
      >;
      runScheduledCleanup: FunctionReference<
        "mutation",
        "internal",
        { tenantId?: string },
        {
          expiredEffectivePermissions: number;
          expiredEffectiveRoles: number;
          expiredOverrides: number;
          expiredRoleAssignments: number;
        },
        Name
      >;
    };
    queries: {
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
            | "attribute_removed"
            | "relation_added"
            | "relation_removed"
            | "policy_evaluated";
          limit?: number;
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          tenantId: string;
          userId?: string;
        },
        | Array<{
            _id: string;
            action: string;
            actorId?: string;
            details: any;
            timestamp: number;
            userId: string;
          }>
        | {
            continueCursor: string;
            isDone: boolean;
            page: Array<{
              _id: string;
              action: string;
              actorId?: string;
              details: any;
              timestamp: number;
              userId: string;
            }>;
          },
        Name
      >;
      getPermissionOverrides: FunctionReference<
        "query",
        "internal",
        { permission?: string; tenantId: string; userId: string },
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
        { key: string; tenantId: string; userId: string },
        null | any,
        Name
      >;
      getUserAttributes: FunctionReference<
        "query",
        "internal",
        { tenantId: string; userId: string },
        Array<{ _id: string; key: string; value: any }>,
        Name
      >;
      getUserRoles: FunctionReference<
        "query",
        "internal",
        {
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
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
        {
          role: string;
          scope?: { id: string; type: string };
          tenantId: string;
        },
        Array<{ assignedAt: number; expiresAt?: number; userId: string }>,
        Name
      >;
      hasRole: FunctionReference<
        "query",
        "internal",
        {
          role: string;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        boolean,
        Name
      >;
    };
    rebac: {
      checkRelationWithTraversal: FunctionReference<
        "query",
        "internal",
        {
          maxBranching?: number;
          maxDepth?: number;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
          tenantId: string;
          traversalRules?: any;
        },
        { allowed: boolean; path: Array<string>; reason: string },
        Name
      >;
      getObjectRelations: FunctionReference<
        "query",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation?: string;
          tenantId: string;
        },
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
        {
          objectType?: string;
          subjectId: string;
          subjectType: string;
          tenantId: string;
        },
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
          tenantId: string;
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
          tenantId: string;
          traversalRules?: any;
        },
        Array<{ objectId: string; via: string }>,
        Name
      >;
      listUsersWithAccess: FunctionReference<
        "query",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          tenantId: string;
        },
        Array<{ userId: string; via: string }>,
        Name
      >;
    };
    unified: {
      addRelationUnified: FunctionReference<
        "mutation",
        "internal",
        {
          caveat?: string;
          caveatContext?: any;
          createdBy?: string;
          enableAudit?: boolean;
          objectId: string;
          objectType: string;
          relation: string;
          relationPermissions?: Record<string, Array<string>>;
          subjectId: string;
          subjectType: string;
          tenantId: string;
        },
        string,
        Name
      >;
      assignRolesUnified: FunctionReference<
        "mutation",
        "internal",
        {
          assignedBy?: string;
          enableAudit?: boolean;
          policyClassifications?: Record<
            string,
            null | "allow" | "deny" | "deferred"
          >;
          rolePermissionsMap: Record<string, Array<string>>;
          roles: Array<{
            expiresAt?: number;
            metadata?: any;
            role: string;
            scope?: { id: string; type: string };
          }>;
          tenantId: string;
          userId: string;
        },
        { assigned: number; assignmentIds: Array<string> },
        Name
      >;
      assignRoleUnified: FunctionReference<
        "mutation",
        "internal",
        {
          assignedBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          metadata?: any;
          policyClassifications?: Record<
            string,
            null | "allow" | "deny" | "deferred"
          >;
          role: string;
          rolePermissions: Array<string>;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        string,
        Name
      >;
      checkPermission: FunctionReference<
        "query",
        "internal",
        {
          permission: string;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        { allowed: boolean; policyName?: string; reason: string; tier: string },
        Name
      >;
      denyPermissionUnified: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        string,
        Name
      >;
      grantPermissionUnified: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        string,
        Name
      >;
      listUserIdsWithRole: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          role: string;
          tenantId: string;
        },
        { continueCursor: string; isDone: boolean; userIds: Array<string> },
        Name
      >;
      recomputeUser: FunctionReference<
        "mutation",
        "internal",
        {
          policyClassifications?: Record<
            string,
            null | "allow" | "deny" | "deferred"
          >;
          rolePermissionsMap: Record<string, Array<string>>;
          tenantId: string;
          userId: string;
        },
        null,
        Name
      >;
      removeRelationUnified: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          objectId: string;
          objectType: string;
          relation: string;
          relationPermissions?: Record<string, Array<string>>;
          removedBy?: string;
          subjectId: string;
          subjectType: string;
          tenantId: string;
        },
        boolean,
        Name
      >;
      revokeAllRolesUnified: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          rolePermissionsMap: Record<string, Array<string>>;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        number,
        Name
      >;
      revokeRolesUnified: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          rolePermissionsMap: Record<string, Array<string>>;
          roles: Array<{ role: string; scope?: { id: string; type: string } }>;
          tenantId: string;
          userId: string;
        },
        { revoked: number },
        Name
      >;
      revokeRoleUnified: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          role: string;
          rolePermissions: Array<string>;
          scope?: { id: string; type: string };
          tenantId: string;
          userId: string;
        },
        boolean,
        Name
      >;
      setAttributeWithRecompute: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          key: string;
          policyReEvaluations?: Record<string, "allow" | "deny">;
          setBy?: string;
          tenantId: string;
          userId: string;
          value: any;
        },
        string,
        Name
      >;
      syncRoleAction: FunctionReference<
        "action",
        "internal",
        {
          policyClassifications?: Record<
            string,
            null | "allow" | "deny" | "deferred"
          >;
          role: string;
          rolePermissionsMap: Record<string, Array<string>>;
          tenantId: string;
        },
        { usersProcessed: number },
        Name
      >;
    };
  };
