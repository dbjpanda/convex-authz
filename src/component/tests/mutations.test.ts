/**
 * Additional mutation tests to cover uncovered code paths
 */

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema.js";
import { api } from "../_generated/api.js";

const modules = import.meta.glob("../**/*.ts");

const TENANT = "test-tenant";

describe("mutations - additional coverage", () => {
  describe("revokeRole", () => {
    it("should return false when revoking non-existent role", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.unified.revokeRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "nonexistent",
        rolePermissions: [],
      });

      expect(result).toBe(false);
    });

    it("should revoke scoped role", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      const result = await t.mutation(api.unified.revokeRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_1" },
      });

      expect(result).toBe(true);
    });

    it("should not revoke when scope doesn't match", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      const result = await t.mutation(api.unified.revokeRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_2" },
      });

      expect(result).toBe(false);
    });

    it("should log audit entry when enabled", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      await t.mutation(api.unified.revokeRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        revokedBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      const revokeLog = logs.find((l) => l.action === "role_revoked");
      expect(revokeLog).toBeDefined();
      expect(revokeLog!.actorId).toBe("actor_1");
    });

    it("should not match scoped vs unscoped", async () => {
      const t = convexTest(schema, modules);

      // Assign a scoped role
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      // Try to revoke global (unscoped) role - shouldn't match
      const result = await t.mutation(api.unified.revokeRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      // Since assignment has scope but revoke has no scope: a.scope exists, args.scope doesn't
      // This will fail because the scope matcher checks: if !a.scope && !args.scope -> false (a.scope exists)
      // if !a.scope || !args.scope -> true for !args.scope but a.scope exists
      // So it returns false for `!a.scope || !args.scope` -> we check: a.scope = {type:"team",...}, args.scope = undefined
      // !a.scope = false, !args.scope = true -> enters this branch -> returns false
      expect(result).toBe(false);
    });
  });

  describe("revokeAllRoles", () => {
    it("should revoke all roles for a user", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: [],
      });

      const count = await t.mutation(api.unified.revokeAllRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        rolePermissionsMap: {},
      });

      expect(count).toBe(2);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(roles).toHaveLength(0);
    });

    it("should revoke only matching scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        scope: { type: "team", id: "team_2" },
        rolePermissions: [],
      });

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "viewer",
        rolePermissions: [],
      });

      // Revoke only team_1 scope
      const count = await t.mutation(api.unified.revokeAllRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        rolePermissionsMap: {},
        scope: { type: "team", id: "team_1" },
      });

      expect(count).toBe(1);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(roles).toHaveLength(2);
    });

    it("should skip assignments without scope when scope filter is set", async () => {
      const t = convexTest(schema, modules);

      // Global (no scope)
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "viewer",
        rolePermissions: [],
      });

      // Scoped
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_1" },
      });

      // Try revoking with scope filter - global one should be skipped
      const count = await t.mutation(api.unified.revokeAllRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        rolePermissionsMap: {},
        scope: { type: "team", id: "team_1" },
      });

      expect(count).toBe(1);
    });

    it("should skip assignments with different scope when scope filter is set", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: [],
        scope: { type: "team", id: "team_2" },
      });

      const count = await t.mutation(api.unified.revokeAllRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        rolePermissionsMap: {},
        scope: { type: "team", id: "team_1" },
      });

      expect(count).toBe(1);
    });

    it("should log audit entries when enabled", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: [],
      });

      await t.mutation(api.unified.revokeAllRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        rolePermissionsMap: {},
        revokedBy: "system",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      const revokeLogs = logs.filter((l) => l.action === "role_revoked");
      expect(revokeLogs).toHaveLength(2);
    });
  });

  describe("assignRoles", () => {
    it("should assign multiple roles in one transaction", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.unified.assignRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        roles: [
          { role: "admin" },
          { role: "editor", scope: { type: "team", id: "team_1" } },
        ],
        enableAudit: true,
              rolePermissionsMap: {},
      });

      expect(result.assigned).toBe(2);
      expect(result.assignmentIds).toHaveLength(2);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(roles).toHaveLength(2);
    });

    it("should skip existing role+scope in bulk assign (idempotent)", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      // assignRolesUnified skips duplicates, only counts new assignments
      const result = await t.mutation(api.unified.assignRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        roles: [{ role: "admin" }, { role: "editor" }],
        rolePermissionsMap: {},
      });

      // Only "editor" is new; "admin" already exists and is skipped
      expect(result.assigned).toBe(1);
    });

    it("should throw when roles exceed limit", async () => {
      const t = convexTest(schema, modules);

      const roles = Array.from({ length: 21 }, (_, i) => ({
        role: "viewer",
        scope: { type: "team", id: `team_${i}` },
      }));

      await expect(
        t.mutation(api.unified.assignRolesUnified, {
          tenantId: TENANT,
          userId: "user_123",
          roles,
        rolePermissionsMap: {},
        })
      ).rejects.toThrow(/must not exceed 20/);
    });
  });

  describe("revokeRoles", () => {
    it("should revoke multiple roles in one transaction", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: [],
      });

      const result = await t.mutation(api.unified.revokeRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        roles: [{ role: "admin" }, { role: "editor" }],
        enableAudit: true,
              rolePermissionsMap: {},
      });

      expect(result.revoked).toBe(2);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(roles).toHaveLength(0);
    });

    it("should only revoke matching scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_2" },
      });

      const result = await t.mutation(api.unified.revokeRolesUnified, {
        tenantId: TENANT,
        userId: "user_123",
        roles: [{ role: "admin", scope: { type: "team", id: "team_1" } }],
              rolePermissionsMap: {},
      });

      expect(result.revoked).toBe(1);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(roles).toHaveLength(1);
      expect(roles[0].scope).toEqual({ type: "team", id: "team_2" });
    });
  });

  describe("offboardUser", () => {
    it("should remove all roles, overrides, and attributes for user", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_off",
        role: "admin",
        rolePermissions: [],
      });
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_off",
        permission: "documents:read",
      });
      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_off",
        key: "dept",
        value: "eng",
      });

      const result = await t.mutation(api.mutations.offboardUser, {
        tenantId: TENANT,
        userId: "user_off",
        enableAudit: true,
      });

      expect(result.rolesRevoked).toBe(1);
      expect(result.overridesRemoved).toBe(1);
      expect(result.attributesRemoved).toBe(1);
      expect(result.relationshipsRemoved).toBe(0);
      expect(result.effectiveRelationshipsRemoved).toBe(0);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_off",
      });
      expect(roles).toHaveLength(0);

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_off",
      });
      expect(overrides).toHaveLength(0);

      const attrs = await t.query(api.queries.getUserAttributes, {
        tenantId: TENANT,
        userId: "user_off",
      });
      expect(attrs).toHaveLength(0);
    });

    it("should remove ReBAC relationships on full offboard (no scope)", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_rel",
        role: "viewer",
        rolePermissions: [],
      });
      await t.mutation(api.unified.addRelationUnified, {
        tenantId: TENANT,
        subjectType: "user",
        subjectId: "user_rel",
        relation: "member",
        objectType: "team",
        objectId: "team_1",
      });

      const result = await t.mutation(api.mutations.offboardUser, {
        tenantId: TENANT,
        userId: "user_rel",
      });

      expect(result.rolesRevoked).toBe(1);
      expect(result.relationshipsRemoved).toBe(1);

      const relations = await t.query(api.rebac.getSubjectRelations, {
        tenantId: TENANT,
        subjectType: "user",
        subjectId: "user_rel",
      });
      expect(relations).toHaveLength(0);
    });

    it("should not remove relationships when scope is provided", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.addRelationUnified, {
        tenantId: TENANT,
        subjectType: "user",
        subjectId: "user_scoped_rel",
        relation: "member",
        objectType: "team",
        objectId: "team_1",
      });
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_scoped_rel",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_1" },
      });

      const result = await t.mutation(api.mutations.offboardUser, {
        tenantId: TENANT,
        userId: "user_scoped_rel",
        scope: { type: "team", id: "team_1" },
      });

      expect(result.rolesRevoked).toBe(1);
      expect(result.relationshipsRemoved).toBe(0);

      const relations = await t.query(api.rebac.getSubjectRelations, {
        tenantId: TENANT,
        subjectType: "user",
        subjectId: "user_scoped_rel",
      });
      expect(relations).toHaveLength(1);
    });

    it("should respect scope when provided", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_off2",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_off2",
        role: "viewer",
        rolePermissions: [],
        scope: { type: "team", id: "team_2" },
      });

      const result = await t.mutation(api.mutations.offboardUser, {
        tenantId: TENANT,
        userId: "user_off2",
        scope: { type: "team", id: "team_1" },
      });

      expect(result.rolesRevoked).toBe(1);

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_off2",
      });
      expect(roles).toHaveLength(1);
      expect(roles[0].role).toBe("viewer");
      expect(roles[0].scope).toEqual({ type: "team", id: "team_2" });
    });

    it("should skip attributes and overrides when options false", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_off3",
        role: "admin",
        rolePermissions: [],
      });
      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_off3",
        key: "keep",
        value: "me",
      });

      await t.mutation(api.mutations.offboardUser, {
        tenantId: TENANT,
        userId: "user_off3",
        removeAttributes: false,
        removeOverrides: false,
      });

      const roles = await t.query(api.queries.getUserRoles, {
        tenantId: TENANT,
        userId: "user_off3",
      });
      expect(roles).toHaveLength(0);

      const attrs = await t.query(api.queries.getUserAttributes, {
        tenantId: TENANT,
        userId: "user_off3",
      });
      expect(attrs).toHaveLength(1);
      expect(attrs[0].key).toBe("keep");
    });
  });

  describe("deprovisionUser", () => {
    it("should wipe all roles, overrides, attributes, and relationships in one call", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_dep",
        role: "admin",
        rolePermissions: [],
      });
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_dep",
        permission: "documents:read",
      });
      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_dep",
        key: "dept",
        value: "eng",
      });
      await t.mutation(api.unified.addRelationUnified, {
        tenantId: TENANT,
        subjectType: "user",
        subjectId: "user_dep",
        relation: "member",
        objectType: "team",
        objectId: "team_1",
      });

      const result = await t.mutation(api.mutations.deprovisionUser, {
        tenantId: TENANT,
        userId: "user_dep",
        enableAudit: true,
      });

      expect(result.rolesRevoked).toBe(1);
      expect(result.overridesRemoved).toBe(1);
      expect(result.attributesRemoved).toBe(1);
      expect(result.relationshipsRemoved).toBe(1);

      const roles = await t.query(api.queries.getUserRoles, { tenantId: TENANT, userId: "user_dep" });
      expect(roles).toHaveLength(0);
      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_dep",
      });
      expect(overrides).toHaveLength(0);
      const attrs = await t.query(api.queries.getUserAttributes, {
        tenantId: TENANT,
        userId: "user_dep",
      });
      expect(attrs).toHaveLength(0);
      const relations = await t.query(api.rebac.getSubjectRelations, {
        tenantId: TENANT,
        subjectType: "user",
        subjectId: "user_dep",
      });
      expect(relations).toHaveLength(0);
    });
  });

  describe("setAttribute", () => {
    it("should update existing attribute", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        value: "engineering",
      });

      const result = await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        value: "sales",
      });

      expect(result).toBeDefined();

      const value = await t.query(api.queries.getUserAttribute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
      });
      expect(value).toBe("sales");
    });

    it("should log audit when updating existing attribute", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        value: "engineering",
      });

      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        value: "sales",
        setBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "attribute_set")).toBe(true);
    });

    it("should log audit when creating new attribute", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        value: "engineering",
        setBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "attribute_set")).toBe(true);
    });
  });

  describe("removeAttribute", () => {
    it("should return false when attribute does not exist", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.mutations.removeAttribute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "nonexistent",
      });

      expect(result).toBe(false);
    });

    it("should log audit when removing attribute", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.setAttributeWithRecompute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        value: "engineering",
      });

      await t.mutation(api.mutations.removeAttribute, {
        tenantId: TENANT,
        userId: "user_123",
        key: "department",
        removedBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "attribute_removed")).toBe(true);
    });
  });


  describe("grantPermission", () => {
    it("should update existing override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        reason: "Initial grant",
      });

      // Grant again should update existing
      const result = await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        reason: "Updated grant",
      });

      expect(result).toBeDefined();

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      expect(overrides).toHaveLength(1);
      expect(overrides[0].reason).toBe("Updated grant");
    });

    it("should log audit when updating existing override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        createdBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "permission_granted")).toBe(true);
    });

    it("should log audit when creating new override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        createdBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "permission_granted")).toBe(true);
    });

    it("should handle scoped overrides", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_1" },
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      expect(overrides).toHaveLength(1);
      expect(overrides[0].scope).toEqual({ type: "team", id: "team_1" });
    });

    it("should accept wildcard pattern (documents:*)", async () => {
      const t = convexTest(schema, modules);

      const id = await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:*",
        reason: "Full document access",
      });

      expect(id).toBeDefined();
      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(overrides.some((o) => o.permission === "documents:*")).toBe(true);
    });

    it("should accept full wildcard pattern (*)", async () => {
      const t = convexTest(schema, modules);

      const id = await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "*",
      });

      expect(id).toBeDefined();
      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(overrides.some((o) => o.permission === "*")).toBe(true);
    });
  });

  describe("denyPermission", () => {
    it("should update existing override to deny", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        reason: "Initial deny",
      });

      // Deny again should update existing
      const result = await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        reason: "Updated deny",
      });

      expect(result).toBeDefined();

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      expect(overrides).toHaveLength(1);
      expect(overrides[0].effect).toBe("deny");
    });

    it("should log audit when updating existing deny override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        createdBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "permission_denied")).toBe(true);
    });

    it("should log audit when creating new deny override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        createdBy: "actor_1",
        enableAudit: true,
      });

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;

      expect(logs.some((l) => l.action === "permission_denied")).toBe(true);
    });

    it("should accept wildcard pattern (documents:*)", async () => {
      const t = convexTest(schema, modules);

      const id = await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:*",
        reason: "Revoke all document access",
      });

      expect(id).toBeDefined();
      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
      });
      expect(overrides.some((o) => o.permission === "documents:*" && o.effect === "deny")).toBe(
        true
      );
    });
  });

  describe("removeOverride", () => {
    it("should remove a direct override and delete effective permission with no remaining sources", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        reason: "Temporary access",
      });

      const result = await t.mutation(api.unified.removeOverrideUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        rolePermissionsMap: {},
        removedBy: "actor_1",
        enableAudit: true,
      });

      expect(result).toBe(true);

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });
      expect(overrides).toHaveLength(0);

      const check = await t.query(api.unified.checkPermission, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });
      expect(check.allowed).toBe(false);

      const logsResult = await t.query(api.queries.getAuditLog, {
        tenantId: TENANT,
        userId: "user_123",
      });
      const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
      expect(logs.some((l) => l.action === "permission_override_removed")).toBe(true);
    });

    it("should restore role-derived allow after removing a deny override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: ["documents:delete"],
      });

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        reason: "Temporary block",
      });

      let check = await t.query(api.unified.checkPermission, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });
      expect(check.allowed).toBe(false);

      const result = await t.mutation(api.unified.removeOverrideUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        rolePermissionsMap: {
          editor: ["documents:delete"],
        },
      });

      expect(result).toBe(true);

      check = await t.query(api.unified.checkPermission, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });
      expect(check.allowed).toBe(true);

      const effectivePerms = await t.run(async (ctx) =>
        await ctx.db.query("effectivePermissions").collect()
      );
      const restored = effectivePerms.find(
        (perm) =>
          perm.userId === "user_123" &&
          perm.permission === "documents:delete" &&
          perm.scopeKey === "global"
      );

      expect(restored).toBeDefined();
      expect(restored?.effect).toBe("allow");
      expect(restored?.sources).toEqual(["editor"]);
      expect(restored?.directDeny).toBeUndefined();
      expect(restored?.directGrant).toBeUndefined();
      expect(restored?.reason).toBeUndefined();
    });

    it("should restore role expiration after removing a grant override", async () => {
      const t = convexTest(schema, modules);
      const expiresAt = Date.now() + 3600000;

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: ["documents:delete"],
        expiresAt,
      });

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      await t.mutation(api.unified.removeOverrideUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        rolePermissionsMap: {
          editor: ["documents:delete"],
        },
      });

      const effectivePerms = await t.run(async (ctx) =>
        await ctx.db.query("effectivePermissions").collect()
      );
      const restored = effectivePerms.find(
        (perm) => perm.userId === "user_123" && perm.permission === "documents:delete"
      );

      expect(restored?.expiresAt).toBe(expiresAt);
    });

    it("should restore deferred policy state after removing a grant override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: ["documents:delete"],
        policyClassifications: {
          "documents:delete": "deferred",
        },
      });

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      await t.mutation(api.unified.removeOverrideUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        rolePermissionsMap: {
          editor: ["documents:delete"],
        },
        policyClassifications: {
          "documents:delete": "deferred",
        },
      });

      const check = await t.query(api.unified.checkPermission, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      expect(check.allowed).toBe(true);
      expect(check.tier).toBe("deferred");
      expect(check.policyName).toBe("documents:delete");
    });

    it("should drop stale role sources that are no longer in the role permissions map", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "legacy_editor",
        rolePermissions: ["documents:delete"],
      });

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      await t.mutation(api.unified.removeOverrideUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        rolePermissionsMap: {},
      });

      const check = await t.query(api.unified.checkPermission, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      expect(check.allowed).toBe(false);
    });

    it("should return false when no matching override exists", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.unified.removeOverrideUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        rolePermissionsMap: {},
      });

      expect(result).toBe(false);
    });
  });



  describe("cleanupExpired", () => {
    it("should clean up expired role assignments", async () => {
      const t = convexTest(schema, modules);

      const pastTime = Date.now() - 10000;

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        expiresAt: pastTime,
        rolePermissions: [],
      });

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "editor",
        rolePermissions: [],
      });

      const result = await t.mutation(api.mutations.cleanupExpired, { tenantId: TENANT });

      expect(result.expiredRoles).toBe(1);
    });

    it("should clean up expired permission overrides", async () => {
      const t = convexTest(schema, modules);

      const pastTime = Date.now() - 10000;

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        expiresAt: pastTime,
      });

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:write",
      });

      const result = await t.mutation(api.mutations.cleanupExpired, { tenantId: TENANT });

      expect(result.expiredOverrides).toBe(1);
    });

    it("should return zeros when nothing is expired", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.mutations.cleanupExpired, { tenantId: TENANT });

      expect(result.expiredRoles).toBe(0);
      expect(result.expiredOverrides).toBe(0);
    });
  });

  describe("runScheduledCleanup", () => {
    it("should purge expired role assignments and overrides and return counts", async () => {
      const t = convexTest(schema, modules);
      const pastTime = Date.now() - 10000;

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_1",
        role: "admin",
        expiresAt: pastTime,
        rolePermissions: [],
      });
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_2",
        role: "editor",
        rolePermissions: [],
      });
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_1",
        permission: "documents:read",
        expiresAt: pastTime,
      });

      const result = await t.mutation(api.mutations.runScheduledCleanup, { tenantId: TENANT });

      expect(result.expiredRoleAssignments).toBe(1);
      expect(result.expiredOverrides).toBe(1);
      expect(result.expiredEffectiveRoles).toBeGreaterThanOrEqual(0);
      expect(result.expiredEffectivePermissions).toBeGreaterThanOrEqual(0);
    });

    it("should return all zeros when nothing is expired", async () => {
      const t = convexTest(schema, modules);
      const result = await t.mutation(api.mutations.runScheduledCleanup, { tenantId: TENANT });
      expect(result.expiredRoleAssignments).toBe(0);
      expect(result.expiredOverrides).toBe(0);
      expect(result.expiredEffectiveRoles).toBe(0);
      expect(result.expiredEffectivePermissions).toBe(0);
    });
  });

  describe("runAuditRetentionCleanup", () => {
    it("should return zeros when no policy args and no env", async () => {
      const t = convexTest(schema, modules);
      const result = await t.mutation(api.mutations.runAuditRetentionCleanup, { tenantId: TENANT });
      expect(result.deletedByAge).toBe(0);
      expect(result.deletedByCount).toBe(0);
    });

    it("should not delete when maxAgeDays is 0", async () => {
      const t = convexTest(schema, modules);
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_1",
        role: "admin",
        rolePermissions: [],
        enableAudit: true,
      });
      const result = await t.mutation(api.mutations.runAuditRetentionCleanup, {
        tenantId: TENANT,
        maxAgeDays: 0,
      });
      expect(result.deletedByAge).toBe(0);
    });

    it("should not delete when maxEntries is 0", async () => {
      const t = convexTest(schema, modules);
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_1",
        role: "admin",
        rolePermissions: [],
        enableAudit: true,
      });
      const result = await t.mutation(api.mutations.runAuditRetentionCleanup, {
        tenantId: TENANT,
        maxEntries: 0,
      });
      expect(result.deletedByCount).toBe(0);
    });

    it("should cap entries when maxEntries is set", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_1",
        role: "admin",
        enableAudit: true,
        rolePermissions: [],
      });
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_1",
        role: "editor",
        rolePermissions: [],
        enableAudit: true,
      });
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_1",
        permission: "documents:read",
        enableAudit: true,
      });

      const before = await t.query(api.queries.getAuditLog, { tenantId: TENANT });
      const initialCount = Array.isArray(before) ? before.length : before.page.length;
      expect(initialCount).toBeGreaterThanOrEqual(2);

      const result = await t.mutation(api.mutations.runAuditRetentionCleanup, {
        tenantId: TENANT,
        maxEntries: 1,
      });

      expect(result.deletedByCount).toBeGreaterThanOrEqual(1);

      const after = await t.query(api.queries.getAuditLog, { tenantId: TENANT });
      const afterCount = Array.isArray(after) ? after.length : after.page.length;
      expect(afterCount).toBe(1);
    });
  });

  describe("assignRole - expired duplicate handling", () => {
    it("should allow assigning role if previous assignment expired", async () => {
      const t = convexTest(schema, modules);

      const pastTime = Date.now() - 10000;

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        expiresAt: pastTime,
        rolePermissions: [],
      });

      // Should not throw since the previous assignment is expired
      const result = await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      expect(result).toBeDefined();
    });
  });

  describe("assignRole - scope comparison edge cases", () => {
    it("should upsert duplicate scoped assignment (idempotent)", async () => {
      const t = convexTest(schema, modules);

      const id1 = await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      // Assigning the same scoped role again should succeed (upsert)
      const id2 = await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_1" },
      });

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });

    it("should allow assigning same role with different scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      // Different scope should be ok
      const result = await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
        scope: { type: "team", id: "team_2" },
      });

      expect(result).toBeDefined();
    });

    it("should allow assigning global role when scoped exists", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        scope: { type: "team", id: "team_1" },
        rolePermissions: [],
      });

      // Global role should be a separate assignment
      const result = await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: "user_123",
        role: "admin",
        rolePermissions: [],
      });

      expect(result).toBeDefined();
    });
  });

  describe("grantPermission - scoped duplicate handling", () => {
    it("should update existing scoped override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_1" },
        reason: "Initial",
      });

      // Same permission, same scope - should update
      const result = await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_1" },
        reason: "Updated",
      });

      expect(result).toBeDefined();
    });

    it("should create new override for different scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_1" },
      });

      // Different scope - new override
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_2" },
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      expect(overrides).toHaveLength(2);
    });
  });

  describe("denyPermission - scoped duplicate handling", () => {
    it("should update existing scoped deny override", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        scope: { type: "team", id: "team_1" },
        reason: "Initial",
      });

      // Same permission, same scope - should update
      const result = await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        scope: { type: "team", id: "team_1" },
        reason: "Updated",
      });

      expect(result).toBeDefined();
    });

    it("should create new deny override for different scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        scope: { type: "team", id: "team_1" },
      });

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        scope: { type: "team", id: "team_2" },
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      expect(overrides).toHaveLength(2);
    });
  });

  describe("grantPermission - scope mismatch branches", () => {
    it("should not find duplicate when existing has no scope but request has scope", async () => {
      const t = convexTest(schema, modules);

      // Unscoped override
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      // Scoped override - should create new, not update
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_1" },
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      expect(overrides).toHaveLength(2);
    });

    it("should not find duplicate when existing has scope but request has no scope", async () => {
      const t = convexTest(schema, modules);

      // Scoped override
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        scope: { type: "team", id: "team_1" },
      });

      // Unscoped override - should create new, not update
      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
      });

      expect(overrides).toHaveLength(2);
    });
  });

  describe("denyPermission - scope mismatch branches", () => {
    it("should not find duplicate when existing has no scope but request has scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        scope: { type: "team", id: "team_1" },
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      expect(overrides).toHaveLength(2);
    });

    it("should not find duplicate when existing has scope but request has no scope", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        scope: { type: "team", id: "team_1" },
      });

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      const overrides = await t.query(api.queries.getPermissionOverrides, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
      });

      expect(overrides).toHaveLength(2);
    });
  });

  describe("grantPermission - expired override in duplicate check", () => {
    it("should create new override when existing one is expired", async () => {
      const t = convexTest(schema, modules);

      const pastTime = Date.now() - 10000;

      await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        expiresAt: pastTime,
      });

      // Should not find the expired override as duplicate, so creates new
      const result = await t.mutation(api.unified.grantPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:read",
        reason: "Fresh grant",
      });

      expect(result).toBeDefined();
    });
  });

  describe("denyPermission - expired override in duplicate check", () => {
    it("should create new override when existing one is expired", async () => {
      const t = convexTest(schema, modules);

      const pastTime = Date.now() - 10000;

      await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        expiresAt: pastTime,
      });

      // Should not find the expired override as duplicate
      const result = await t.mutation(api.unified.denyPermissionUnified, {
        tenantId: TENANT,
        userId: "user_123",
        permission: "documents:delete",
        reason: "Fresh deny",
      });

      expect(result).toBeDefined();
    });
  });

});
