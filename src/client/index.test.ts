import { describe, expect, it, vi } from "vitest";
import {
  definePermissions,
  defineRoles,
  definePolicies,
  evaluatePolicyCondition,
  flattenRolePermissions,
  Authz,
  matchesPermissionPattern,
  parsePermission,
  buildPermission,
  defineTraversalRules,
  defineRelationPermissions,
  defineCaveats,
} from "./index.js";
import type { PolicyContext, PolicyDefinition } from "./index.js";
import type { ComponentApi } from "../component/_generated/component.js";

// ============================================================================
// Helper function tests
// ============================================================================

describe("client helpers", () => {
  describe("definePermissions", () => {
    it("should return permissions as-is for single definition", () => {
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

      expect(permissions.documents.create).toBe(true);
      expect(permissions.settings.manage).toBe(true);
    });

    it("should merge two permission definitions", () => {
      const p1 = { documents: { read: true, write: true } };
      const p2 = { settings: { view: true, manage: true } };

      const merged = definePermissions(p1, p2);

      expect(merged.documents.read).toBe(true);
      expect(merged.settings.view).toBe(true);
    });

    it("should merge overlapping resources across definitions", () => {
      const p1 = { documents: { read: true } };
      const p2 = { documents: { write: true }, settings: { view: true } };

      const merged = definePermissions(p1, p2);

      expect(merged.documents.read).toBe(true);
      expect(merged.documents.write).toBe(true);
      expect(merged.settings.view).toBe(true);
    });

    it("should merge three permission definitions", () => {
      const p1 = { documents: { read: true } };
      const p2 = { settings: { view: true } };
      const p3 = { billing: { manage: true } };

      const merged = definePermissions(p1, p2, p3);

      expect(merged.documents.read).toBe(true);
      expect(merged.settings.view).toBe(true);
      expect(merged.billing.manage).toBe(true);
    });
  });

  describe("defineRoles", () => {
    const permissions = definePermissions({
      documents: { create: true, read: true },
      settings: { view: true },
    });

    it("should return roles as-is for single definition", () => {
      const roles = defineRoles(permissions, {
        admin: { documents: ["create", "read"] },
        viewer: { documents: ["read"] },
      });

      expect(roles.admin.documents).toEqual(["create", "read"]);
      expect(roles.viewer.documents).toEqual(["read"]);
    });

    it("should merge two role definitions", () => {
      const r1 = { admin: { documents: ["create", "read"] as const } };
      const r2 = { viewer: { documents: ["read"] as const } };

      const merged = defineRoles(permissions, r1, r2);

      expect(merged.admin.documents).toEqual(["create", "read"]);
      expect(merged.viewer.documents).toEqual(["read"]);
    });

    it("should merge overlapping roles and deduplicate permissions", () => {
      const r1 = { admin: { documents: ["read"] as const } };
      const r2 = { admin: { documents: ["read", "create"] as const, settings: ["view"] as const } };

      const merged = defineRoles(permissions, r1, r2);

      // Permissions should be deduplicated
      expect(merged.admin.documents).toEqual(["read", "create"]);
      expect(merged.admin.settings).toEqual(["view"]);
    });

    it("should merge three role definitions", () => {
      const r1 = { admin: { documents: ["read"] as const } };
      const r2 = { viewer: { documents: ["read"] as const } };
      const r3 = { editor: { documents: ["read", "create"] as const } };

      const merged = defineRoles(permissions, r1, r2, r3);

      expect(merged.admin.documents).toEqual(["read"]);
      expect(merged.viewer.documents).toEqual(["read"]);
      expect(merged.editor.documents).toEqual(["read", "create"]);
    });

    it("should merge roles where existing role gets new resources from later defs", () => {
      const r1 = { admin: { documents: ["read"] as const } };
      const r2 = { admin: { settings: ["view"] as const } };

      const merged = defineRoles(permissions, r1, r2);

      expect(merged.admin.documents).toEqual(["read"]);
      expect(merged.admin.settings).toEqual(["view"]);
    });

    it("should merge role defs with inherits (last wins)", () => {
      const permsWithUpdateDelete = definePermissions({
        documents: { create: true, read: true, update: true, delete: true },
        settings: { view: true, manage: true },
      });
      const r1 = {
        editor: { documents: ["create", "read", "update"] as const },
        admin: { inherits: "editor" as const, documents: ["delete"] as const },
      };
      const r2 = {
        admin: { inherits: "editor" as const, settings: ["manage"] as const },
      };
      const merged = defineRoles(permsWithUpdateDelete, r1, r2);
      expect(merged.admin.inherits).toBe("editor");
      expect(merged.admin.documents).toEqual(["delete"]);
      expect(merged.admin.settings).toEqual(["manage"]);
    });

    it("should merge includes arrays and deduplicate", () => {
      const r1 = {
        editor: { documents: ["read", "create"] as const },
        composite: { includes: ["editor"] as const },
      };
      const r2 = {
        composite: { includes: ["editor", "editor"] as const },
      };
      const merged = defineRoles(permissions, r1, r2);
      expect(merged.composite.includes).toEqual(["editor"]);
    });
  });

  describe("definePolicies", () => {
    it("should return policies as-is", () => {
      const policies = definePolicies({
        isAdmin: {
          condition: (ctx) => ctx.subject.roles.includes("admin"),
          message: "Must be admin",
        },
      });

      expect(policies.isAdmin.message).toBe("Must be admin");
    });

    it("should accept async policy condition", () => {
      const policies = definePolicies({
        asyncCheck: {
          condition: async () => true,
          message: "Async policy",
        },
      });
      expect(policies.asyncCheck.message).toBe("Async policy");
    });

    it("should accept policy condition that returns Promise", () => {
      const policies = definePolicies({
        promiseCheck: {
          condition: () => Promise.resolve(false),
          message: "Promise-returning policy",
        },
      });
      expect(policies.promiseCheck.message).toBe("Promise-returning policy");
    });
  });

  describe("evaluatePolicyCondition", () => {
    const baseCtx: PolicyContext = {
      subject: { userId: "u1", roles: [], attributes: {} },
      action: "test",
      hasRole: () => false,
      hasAttribute: () => false,
      getAttribute: () => undefined,
    };

    it("should return resolved value for sync condition", async () => {
      const result = evaluatePolicyCondition(() => true, baseCtx);
      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe(true);
      expect(await evaluatePolicyCondition(() => false, baseCtx)).toBe(false);
    });

    it("should return resolved value for async condition", async () => {
      const result = evaluatePolicyCondition(
        () => Promise.resolve(false),
        baseCtx
      );
      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe(false);
      expect(
        await evaluatePolicyCondition(async () => true, baseCtx)
      ).toBe(true);
    });
  });

  describe("flattenRolePermissions", () => {
    it("should flatten role permissions to strings", () => {
      const roles = {
        admin: {
          documents: ["create", "read", "update", "delete"],
          settings: ["view", "manage"],
        },
        viewer: {
          documents: ["read"],
        },
      };

      const adminPerms = flattenRolePermissions(roles, "admin");
      expect(adminPerms).toContain("documents:create");
      expect(adminPerms).toContain("documents:read");
      expect(adminPerms).toContain("settings:manage");
      expect(adminPerms).toHaveLength(6);

      const viewerPerms = flattenRolePermissions(roles, "viewer");
      expect(viewerPerms).toEqual(["documents:read"]);
    });

    it("should return empty array for unknown role", () => {
      const roles = {
        admin: { documents: ["read"] },
      };

      const perms = flattenRolePermissions(roles, "unknown");
      expect(perms).toEqual([]);
    });

    it("should skip non-array actions", () => {
      // Edge case: if a role has non-array property
      const roles = {
        admin: { documents: "read" }, // string instead of array
      } as unknown as Record<string, Record<string, string[]>>;

      const perms = flattenRolePermissions(roles, "admin");
      // Non-array value should be skipped
      expect(perms).toEqual([]);
    });

    it("should resolve inherits: role gets inherited permissions plus own", () => {
      const roles = {
        viewer: { documents: ["read"] },
        editor: {
          inherits: "viewer",
          documents: ["create", "update"],
        },
      };
      const perms = flattenRolePermissions(roles, "editor");
      expect(perms).toContain("documents:read");
      expect(perms).toContain("documents:create");
      expect(perms).toContain("documents:update");
      expect(perms).toHaveLength(3);
    });

    it("should resolve includes: role gets union of included roles plus own", () => {
      const roles = {
        editor: { documents: ["read", "create", "update"] },
        billing_admin: { billing: ["view", "manage"] },
        billing_manager: {
          includes: ["editor", "billing_admin"],
          settings: ["view"],
        },
      };
      const perms = flattenRolePermissions(roles, "billing_manager");
      expect(perms).toContain("documents:read");
      expect(perms).toContain("documents:create");
      expect(perms).toContain("billing:view");
      expect(perms).toContain("billing:manage");
      expect(perms).toContain("settings:view");
      expect(perms).toHaveLength(6);
    });

    it("should resolve chain of three (admin inherits manager inherits editor)", () => {
      const roles = {
        editor: { documents: ["read", "create", "update"] },
        manager: { inherits: "editor", documents: ["archive"] },
        admin: { inherits: "manager", documents: ["delete"], settings: ["manage"] },
      };
      const perms = flattenRolePermissions(roles, "admin");
      expect(perms).toContain("documents:read");
      expect(perms).toContain("documents:create");
      expect(perms).toContain("documents:update");
      expect(perms).toContain("documents:archive");
      expect(perms).toContain("documents:delete");
      expect(perms).toContain("settings:manage");
      expect(perms).toHaveLength(6);
    });

    it("should throw when inherits references unknown role", () => {
      const roles = {
        admin: { inherits: "nonexistent", documents: ["read"] },
      };
      expect(() => flattenRolePermissions(roles, "admin")).toThrow(
        'Role "admin" inherits unknown role "nonexistent"'
      );
    });

    it("should throw when includes references unknown role", () => {
      const roles = {
        composite: { includes: ["editor", "ghost"], documents: ["read"] },
        editor: { documents: ["read"] },
      };
      expect(() => flattenRolePermissions(roles, "composite")).toThrow(
        'Role "composite" includes unknown role "ghost"'
      );
    });

    it("should throw on role inheritance cycle", () => {
      const roles = {
        a: { inherits: "b", documents: ["read"] },
        b: { inherits: "a", documents: ["create"] },
      };
      expect(() => flattenRolePermissions(roles, "a")).toThrow(
        /Role inheritance cycle detected/
      );
    });

    it("should behave as before when role has no inherits or includes", () => {
      const roles = {
        admin: {
          documents: ["create", "read", "update", "delete"],
          settings: ["view", "manage"],
        },
        viewer: { documents: ["read"] },
      };
      const adminPerms = flattenRolePermissions(roles, "admin");
      expect(adminPerms).toContain("documents:create");
      expect(adminPerms).toContain("documents:read");
      expect(adminPerms).toContain("settings:manage");
      expect(adminPerms).toHaveLength(6);
      const viewerPerms = flattenRolePermissions(roles, "viewer");
      expect(viewerPerms).toEqual(["documents:read"]);
    });
  });
});

// ============================================================================
// Wildcard and pattern-matching permissions (API surface)
// ============================================================================

describe("wildcard and pattern matching", () => {
  describe("exported helpers", () => {
    it("matchesPermissionPattern matches resource wildcard", () => {
      expect(matchesPermissionPattern("documents:read", "documents:*")).toBe(true);
      expect(matchesPermissionPattern("documents:delete", "documents:*")).toBe(true);
      expect(matchesPermissionPattern("settings:read", "documents:*")).toBe(false);
    });

    it("matchesPermissionPattern matches action wildcard", () => {
      expect(matchesPermissionPattern("documents:read", "*:read")).toBe(true);
      expect(matchesPermissionPattern("settings:read", "*:read")).toBe(true);
      expect(matchesPermissionPattern("documents:write", "*:read")).toBe(false);
    });

    it("matchesPermissionPattern matches full wildcard", () => {
      expect(matchesPermissionPattern("documents:read", "*")).toBe(true);
      expect(matchesPermissionPattern("any:action", "*")).toBe(true);
    });

    it("parsePermission and buildPermission round-trip", () => {
      const { resource, action } = parsePermission("documents:read");
      expect(resource).toBe("documents");
      expect(action).toBe("read");
      expect(buildPermission("documents", "read")).toBe("documents:read");
    });

    it("parsePermission throws for invalid format", () => {
      expect(() => parsePermission("read")).toThrow(/Expected "resource:action"/);
      expect(() => parsePermission("a:b:c")).toThrow(/Expected "resource:action"/);
    });
  });

  describe("Authz grant/deny accept wildcard patterns", () => {
    function createMockComponent() {
      return {
        queries: {
          checkPermission: "queries.checkPermission",
          checkPermissions: "queries.checkPermissions",
          hasRole: "queries.hasRole",
          getUserRoles: "queries.getUserRoles",
          getEffectivePermissions: "queries.getEffectivePermissions",
          getUserAttributes: "queries.getUserAttributes",
          getAuditLog: "queries.getAuditLog",
        },
        mutations: {
          assignRole: "mutations.assignRole",
          assignRoles: "mutations.assignRoles",
          revokeRole: "mutations.revokeRole",
          revokeRoles: "mutations.revokeRoles",
          revokeAllRoles: "mutations.revokeAllRoles",
          offboardUser: "mutations.offboardUser",
          setAttribute: "mutations.setAttribute",
          removeAttribute: "mutations.removeAttribute",
          grantPermission: "mutations.grantPermission",
          denyPermission: "mutations.denyPermission",
        },
        unified: {
          grantPermissionUnified: "unified.grantPermissionUnified",
          denyPermissionUnified: "unified.denyPermissionUnified",
        },
      } as unknown as ComponentApi;
    }

    const permissions = definePermissions({
      documents: { create: true, read: true, update: true, delete: true },
    });
    const roles = defineRoles(permissions, {
      admin: { documents: ["create", "read", "update", "delete"] },
      viewer: { documents: ["read"] },
    });

    it("grantPermission accepts documents:* and passes it to unified mutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };
      await authz.grantPermission(ctx, "user_123", "documents:*", undefined, "Full access");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({ permission: "documents:*", reason: "Full access", tenantId: "test-tenant" })
      );
    });

    it("grantPermission accepts * and passes it to unified mutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };
      await authz.grantPermission(ctx, "user_123", "*");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({ permission: "*", tenantId: "test-tenant" })
      );
    });

    it("denyPermission accepts documents:* and passes it to unified mutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };
      await authz.denyPermission(ctx, "user_123", "documents:*", undefined, "Revoke all");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({ permission: "documents:*", reason: "Revoke all", tenantId: "test-tenant" })
      );
    });
  });

  describe("Authz (alias) grant/deny accept wildcard patterns", () => {
    function createMockComponent() {
      return {
        queries: {
          checkPermission: "queries.checkPermission",
          checkPermissions: "queries.checkPermissions",
          getUserAttributes: "queries.getUserAttributes",
          getAuditLog: "queries.getAuditLog",
        },
        mutations: {},
        unified: {
          checkPermission: "unified.checkPermission",
          grantPermissionUnified: "unified.grantPermissionUnified",
          denyPermissionUnified: "unified.denyPermissionUnified",
        },
        indexed: {
          hasRoleFast: "indexed.hasRoleFast",
          hasRelationFast: "indexed.hasRelationFast",
          getUserRolesFast: "indexed.getUserRolesFast",
          getUserPermissionsFast: "indexed.getUserPermissionsFast",
        },
      } as unknown as ComponentApi;
    }
    const permissions = definePermissions({
      documents: { create: true, read: true, update: true, delete: true },
    });
    const roles = defineRoles(permissions, {
      admin: { documents: ["create", "read", "update", "delete"] },
      viewer: { documents: ["read"] },
    });

    it("grantPermission accepts documents:* and passes it to unified mutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };
      await authz.grantPermission(ctx, "user_123", "documents:*", undefined, "Full access");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({ permission: "documents:*", tenantId: "test-tenant" })
      );
    });

    it("denyPermission accepts *:read and passes it to unified mutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };
      await authz.denyPermission(ctx, "user_123", "*:read");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({ permission: "*:read", tenantId: "test-tenant" })
      );
    });
  });
});

// ============================================================================
// Authz class tests
// ============================================================================

describe("Authz class", () => {
  // Create a mock component with unified + indexed paths
  function createMockComponent() {
    return {
      queries: {
        checkPermission: "queries.checkPermission",
        checkPermissions: "queries.checkPermissions",
        hasRole: "queries.hasRole",
        getUserRoles: "queries.getUserRoles",
        getEffectivePermissions: "queries.getEffectivePermissions",
        getUserAttributes: "queries.getUserAttributes",
        getAuditLog: "queries.getAuditLog",
      },
      mutations: {
        assignRole: "mutations.assignRole",
        assignRoles: "mutations.assignRoles",
        revokeRole: "mutations.revokeRole",
        revokeRoles: "mutations.revokeRoles",
        revokeAllRoles: "mutations.revokeAllRoles",
        offboardUser: "mutations.offboardUser",
        setAttribute: "mutations.setAttribute",
        removeAttribute: "mutations.removeAttribute",
        grantPermission: "mutations.grantPermission",
        denyPermission: "mutations.denyPermission",
      },
      unified: {
        checkPermission: "unified.checkPermission",
        assignRoleUnified: "unified.assignRoleUnified",
        revokeRoleUnified: "unified.revokeRoleUnified",
        assignRolesUnified: "unified.assignRolesUnified",
        revokeRolesUnified: "unified.revokeRolesUnified",
        revokeAllRolesUnified: "unified.revokeAllRolesUnified",
        grantPermissionUnified: "unified.grantPermissionUnified",
        denyPermissionUnified: "unified.denyPermissionUnified",
        addRelationUnified: "unified.addRelationUnified",
        removeRelationUnified: "unified.removeRelationUnified",
        recomputeUser: "unified.recomputeUser",
        syncRoleAction: "unified.syncRoleAction",
      },
      indexed: {
        hasRoleFast: "indexed.hasRoleFast",
        hasRelationFast: "indexed.hasRelationFast",
        getUserRolesFast: "indexed.getUserRolesFast",
        getUserPermissionsFast: "indexed.getUserPermissionsFast",
      },
    } as unknown as ComponentApi;
  }

  const permissions = definePermissions({
    documents: { create: true, read: true, update: true, delete: true },
  });

  const roles = defineRoles(permissions, {
    admin: { documents: ["create", "read", "update", "delete"] },
    viewer: { documents: ["read"] },
  });

  describe("can", () => {
    it("should call unified.checkPermission and return boolean result", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "Granted", tier: "cached" }),
      };

      const result = await authz.can(ctx, "user_123", "documents:read");
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:read",
          scope: undefined,
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass scope when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "Denied", tier: "cached" }),
      };

      const result = await authz.can(ctx, "user_123", "documents:read", {
        type: "team",
        id: "team_456",
      });
      expect(result).toBe(false);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          scope: { type: "team", id: "team_456" },
          tenantId: "test-tenant",
        })
      );
    });

    it("should return true for cached allowed permissions", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "Cached", tier: "cached" }),
      };

      const result = await authz.can(ctx, "user_123", "documents:read");
      expect(result).toBe(true);
    });
  });

  describe("require", () => {
    it("should not throw when permission is allowed", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "Granted", tier: "cached" }),
      };

      await expect(
        authz.require(ctx, "user_123", "documents:read")
      ).resolves.not.toThrow();
    });

    it("should throw when permission is denied", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({
          allowed: false,
          reason: "No matching role",
          tier: "cached",
        }),
      };

      await expect(
        authz.require(ctx, "user_123", "documents:delete")
      ).rejects.toThrow("Permission denied: documents:delete");
    });

    it("should include scope in error message when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({
          allowed: false,
          reason: "Denied",
          tier: "cached",
        }),
      };

      await expect(
        authz.require(ctx, "user_123", "documents:delete", {
          type: "team",
          id: "team_456",
        })
      ).rejects.toThrow(
        "Permission denied: documents:delete on team:team_456"
      );
    });
  });

  describe("hasRole", () => {
    it("should check role via indexed.hasRoleFast", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.hasRole(ctx, "user_123", "admin");
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(component.indexed.hasRoleFast, {
        userId: "user_123",
        role: "admin",
        objectType: undefined,
        objectId: undefined,
        tenantId: "test-tenant",
      });
    });

    it("should pass scope when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(false),
      };

      await authz.hasRole(ctx, "user_123", "admin", {
        type: "org",
        id: "org_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(component.indexed.hasRoleFast, {
        userId: "user_123",
        role: "admin",
        objectType: "org",
        objectId: "org_1",
        tenantId: "test-tenant",
      });
    });
  });

  describe("getUserRoles", () => {
    it("should get user roles via indexed.getUserRolesFast", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const mockRoles = [{ role: "admin", scopeKey: "" }];
      const ctx = {
        runQuery: vi.fn().mockResolvedValue(mockRoles),
      };

      const result = await authz.getUserRoles(ctx, "user_123");
      expect(result).toEqual(mockRoles);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserRolesFast,
        { userId: "user_123", scopeKey: undefined, tenantId: "test-tenant" }
      );
    });

    it("should pass scope as scopeKey when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getUserRoles(ctx, "user_123", {
        type: "team",
        id: "team_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserRolesFast,
        { userId: "user_123", scopeKey: "team:team_1", tenantId: "test-tenant" }
      );
    });
  });

  describe("getUserPermissions", () => {
    it("should get user permissions via indexed.getUserPermissionsFast", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const mockPerms = [{ permission: "documents:read", effect: "allow", scopeKey: "", sources: ["role:viewer"] }];
      const ctx = {
        runQuery: vi.fn().mockResolvedValue(mockPerms),
      };

      const result = await authz.getUserPermissions(ctx, "user_123");
      expect(result).toEqual(mockPerms);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserPermissionsFast,
        { userId: "user_123", scopeKey: undefined, tenantId: "test-tenant" }
      );
    });

    it("should pass scope as scopeKey when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getUserPermissions(ctx, "user_123", {
        type: "org",
        id: "org_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserPermissionsFast,
        { userId: "user_123", scopeKey: "org:org_1", tenantId: "test-tenant" }
      );
    });
  });

  describe("getUserAttributes", () => {
    it("should get user attributes via runQuery", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const mockAttrs = [{ key: "dept", value: "eng" }];
      const ctx = {
        runQuery: vi.fn().mockResolvedValue(mockAttrs),
      };

      const result = await authz.getUserAttributes(ctx, "user_123");
      expect(result).toEqual(mockAttrs);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getUserAttributes,
        { userId: "user_123", tenantId: "test-tenant" }
      );
    });
  });

  describe("canAny", () => {
    it("should call can() for each permission and return true if any allowed", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn()
          .mockResolvedValueOnce({ allowed: false, reason: "Denied", tier: "none" })
          .mockResolvedValueOnce({ allowed: true, reason: "Allowed", tier: "cached" }),
      };

      const result = await authz.canAny(ctx, "user_123", [
        "documents:delete",
        "documents:read",
      ]);
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:delete",
          tenantId: "test-tenant",
        })
      );
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:read",
          tenantId: "test-tenant",
        })
      );
    });

    it("should return false if no permission is allowed", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "Denied", tier: "none" }),
      };

      const result = await authz.canAny(ctx, "user_123", [
        "documents:delete",
        "documents:read",
      ]);
      expect(result).toBe(false);
    });

    it("should reject empty permissions array", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = { runQuery: vi.fn() };

      await expect(
        authz.canAny(ctx, "user_123", [])
      ).rejects.toThrow("permissions must not be empty");
    });
  });

  describe("assignRole", () => {
    it("should assign role via unified.assignRoleUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("assignment_id"),
      };

      const result = await authz.assignRole(ctx, "user_123", "admin");
      expect(result).toBe("assignment_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({
          userId: "user_123",
          role: "admin",
          rolePermissions: [
            "documents:create",
            "documents:read",
            "documents:update",
            "documents:delete",
          ],
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });

    it("should use provided actorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("assignment_id"),
      };

      await authz.assignRole(
        ctx,
        "user_123",
        "admin",
        undefined,
        undefined,
        "actor_1"
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({
          assignedBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId when no actorId provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("assignment_id"),
      };

      await authz.assignRole(ctx, "user_123", "admin");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({
          assignedBy: "default_actor",
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass scope and expiresAt", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("assignment_id"),
      };

      const scope = { type: "team", id: "team_1" };
      const expiresAt = Date.now() + 3600000;

      await authz.assignRole(ctx, "user_123", "admin", scope, expiresAt);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({
          scope,
          expiresAt,
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("revokeRole", () => {
    it("should revoke role via unified.revokeRoleUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.revokeRole(ctx, "user_123", "admin");
      expect(result).toBe(true);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRoleUnified,
        expect.objectContaining({
          userId: "user_123",
          role: "admin",
          rolePermissions: [
            "documents:create",
            "documents:read",
            "documents:update",
            "documents:delete",
          ],
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });

    it("should use provided actorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      await authz.revokeRole(ctx, "user_123", "admin", undefined, "actor_1");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRoleUnified,
        expect.objectContaining({
          revokedBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId when no actorId provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      await authz.revokeRole(ctx, "user_123", "admin");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRoleUnified,
        expect.objectContaining({
          revokedBy: "default_actor",
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("assignRoles", () => {
    it("should call runMutation with assignRolesUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue({
          assigned: 2,
          assignmentIds: ["id1", "id2"],
        }),
      };

      const result = await authz.assignRoles(ctx, "user_123", [
        { role: "admin" },
        { role: "viewer", scope: { type: "team", id: "t1" } },
      ]);
      expect(result.assigned).toBe(2);
      expect(result.assignmentIds).toEqual(["id1", "id2"]);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRolesUnified,
        expect.objectContaining({
          userId: "user_123",
          roles: [
            { role: "admin", scope: undefined, expiresAt: undefined, metadata: undefined },
            { role: "viewer", scope: { type: "team", id: "t1" }, expiresAt: undefined, metadata: undefined },
          ],
          rolePermissionsMap: expect.any(Object),
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("revokeRoles", () => {
    it("should call runMutation with revokeRolesUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue({ revoked: 2 }),
      };

      const result = await authz.revokeRoles(ctx, "user_123", [
        { role: "admin" },
        { role: "viewer" },
      ]);
      expect(result.revoked).toBe(2);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRolesUnified,
        expect.objectContaining({
          userId: "user_123",
          roles: [{ role: "admin", scope: undefined }, { role: "viewer", scope: undefined }],
          rolePermissionsMap: expect.any(Object),
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("revokeAllRoles", () => {
    it("should call runMutation with revokeAllRolesUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(3),
      };

      const result = await authz.revokeAllRoles(ctx, "user_123");
      expect(result).toBe(3);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeAllRolesUnified,
        expect.objectContaining({
          userId: "user_123",
          scope: undefined,
          rolePermissionsMap: expect.any(Object),
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("offboardUser", () => {
    it("should call runMutation with offboardUser", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue({
          rolesRevoked: 1,
          overridesRemoved: 0,
          attributesRemoved: 2,
          effectiveRolesRemoved: 1,
          effectivePermissionsRemoved: 3,
        }),
      };

      const result = await authz.offboardUser(ctx, "user_123", {
        scope: { type: "team", id: "t1" },
        actorId: "actor_1",
      });
      expect(result.rolesRevoked).toBe(1);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.mutations.offboardUser,
        expect.objectContaining({
          userId: "user_123",
          scope: { type: "team", id: "t1" },
          revokedBy: "actor_1",
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("setAttribute", () => {
    it("should set attribute via runMutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("attr_id"),
      };

      const result = await authz.setAttribute(
        ctx,
        "user_123",
        "department",
        "engineering"
      );
      expect(result).toBe("attr_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.setAttributeWithRecompute,
        expect.objectContaining({
          userId: "user_123",
          key: "department",
          value: "engineering",
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });

    it("should use provided actorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("attr_id"),
      };

      await authz.setAttribute(ctx, "user_123", "key", "val", "actor_1");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.setAttributeWithRecompute,
        expect.objectContaining({ setBy: "actor_1", tenantId: "test-tenant" })
      );
    });

    it("should use defaultActorId when no actorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("attr_id"),
      };

      await authz.setAttribute(ctx, "user_123", "key", "val");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.setAttributeWithRecompute,
        expect.objectContaining({ setBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("removeAttribute", () => {
    it("should remove attribute via runMutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.removeAttribute(ctx, "user_123", "department");
      expect(result).toBe(true);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.mutations.removeAttribute,
        expect.objectContaining({
          userId: "user_123",
          key: "department",
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });

    it("should use provided actorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      await authz.removeAttribute(ctx, "user_123", "key", "actor_1");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.mutations.removeAttribute,
        expect.objectContaining({ removedBy: "actor_1", tenantId: "test-tenant" })
      );
    });
  });

  describe("grantPermission", () => {
    it("should grant permission via unified.grantPermissionUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };

      const result = await authz.grantPermission(
        ctx,
        "user_123",
        "documents:delete"
      );
      expect(result).toBe("override_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:delete",
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass all optional parameters", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };

      const scope = { type: "doc", id: "doc_1" };
      const expiresAt = Date.now() + 3600000;

      await authz.grantPermission(
        ctx,
        "user_123",
        "documents:delete",
        scope,
        "Temporary",
        expiresAt,
        "actor_1"
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({
          scope,
          reason: "Temporary",
          expiresAt,
          createdBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };

      await authz.grantPermission(ctx, "user_123", "documents:delete");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({ createdBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("denyPermission", () => {
    it("should deny permission via unified.denyPermissionUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };

      const result = await authz.denyPermission(
        ctx,
        "user_123",
        "documents:delete"
      );
      expect(result).toBe("override_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:delete",
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass all optional parameters", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };

      const scope = { type: "doc", id: "doc_1" };
      const expiresAt = Date.now() + 3600000;

      await authz.denyPermission(
        ctx,
        "user_123",
        "documents:delete",
        scope,
        "Security",
        expiresAt,
        "actor_1"
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({
          scope,
          reason: "Security",
          expiresAt,
          createdBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("override_id"),
      };

      await authz.denyPermission(ctx, "user_123", "documents:delete");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({ createdBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("getAuditLog", () => {
    it("should get audit log with no options", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      const result = await authz.getAuditLog(ctx);
      expect(result).toEqual([]);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getAuditLog,
        expect.objectContaining({
          userId: undefined,
          action: undefined,
          limit: undefined,
          tenantId: "test-tenant",
        })
      );
    });

    it("should request pagination when numItems provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const paginatedResponse = {
        page: [{ _id: "1", timestamp: 1, action: "role_assigned", userId: "u", details: {} }],
        isDone: true,
        continueCursor: "cursor1",
      };

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(paginatedResponse),
      };

      const result = await authz.getAuditLog(ctx, { numItems: 50 });
      expect(result).toEqual(paginatedResponse);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getAuditLog,
        expect.objectContaining({
          paginationOpts: { numItems: 50, cursor: null },
          tenantId: "test-tenant",
        })
      );
    });

    it("should request next page when cursor provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({
          page: [],
          isDone: true,
          continueCursor: "next",
        }),
      };

      await authz.getAuditLog(ctx, { cursor: "prevCursor", numItems: 100 });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getAuditLog,
        expect.objectContaining({
          paginationOpts: { numItems: 100, cursor: "prevCursor" },
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass userId filter", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getAuditLog(ctx, { userId: "user_123" });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getAuditLog,
        expect.objectContaining({ userId: "user_123", tenantId: "test-tenant" })
      );
    });

    it("should pass action filter", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getAuditLog(ctx, { action: "role_assigned" });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getAuditLog,
        expect.objectContaining({ action: "role_assigned", tenantId: "test-tenant" })
      );
    });

    it("should pass limit option", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getAuditLog(ctx, { limit: 50 });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.queries.getAuditLog,
        expect.objectContaining({ limit: 50, tenantId: "test-tenant" })
      );
    });
  });

  describe("canWithContext", () => {
    it("should return true for cached allowed permission (no deferred policy)", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "Cached", tier: "cached" }),
      };

      const result = await authz.canWithContext(ctx, "user_123", "documents:read");
      expect(result).toBe(true);
    });

    it("should return false for denied permission", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "Denied", tier: "cached" }),
      };

      const result = await authz.canWithContext(ctx, "user_123", "documents:delete");
      expect(result).toBe(false);
    });

    it("should evaluate deferred policy with requestContext", async () => {
      const component = createMockComponent();
      const policies = definePolicies({
        isOwner: {
          condition: (ctx) => ctx.resource?.ownerId === ctx.subject.userId,
          message: "Must be owner",
        },
      });
      const authz = new Authz(component, { permissions, roles, policies, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn()
          .mockResolvedValueOnce({ allowed: true, reason: "Deferred", tier: "deferred", policyName: "isOwner" })
          .mockResolvedValueOnce([{ key: "dept", value: "eng" }]) // getUserAttributes
          .mockResolvedValueOnce([{ role: "admin" }]), // getUserRoles
      };

      const result = await authz.canWithContext(
        ctx,
        "user_123",
        "documents:update",
        undefined,
        { ownerId: "user_123" }
      );
      expect(result).toBe(true);
    });

    it("should deny when deferred policy evaluates to false", async () => {
      const component = createMockComponent();
      const policies = definePolicies({
        isOwner: {
          condition: (ctx) => ctx.resource?.ownerId === ctx.subject.userId,
          message: "Must be owner",
        },
      });
      const authz = new Authz(component, { permissions, roles, policies, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn()
          .mockResolvedValueOnce({ allowed: true, reason: "Deferred", tier: "deferred", policyName: "isOwner" })
          .mockResolvedValueOnce([]) // getUserAttributes
          .mockResolvedValueOnce([]), // getUserRoles
      };

      const result = await authz.canWithContext(
        ctx,
        "user_123",
        "documents:update",
        undefined,
        { ownerId: "other_user" }
      );
      expect(result).toBe(false);
    });
  });

  describe("hasRelation", () => {
    it("should check relation via indexed.hasRelationFast", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.hasRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.hasRelationFast,
        {
          subjectType: "user",
          subjectId: "alice",
          relation: "member",
          objectType: "team",
          objectId: "sales",
          tenantId: "test-tenant",
        }
      );
    });
  });

  describe("addRelation", () => {
    it("should add relation via unified.addRelationUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("rel_id"),
      };

      const result = await authz.addRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(result).toBe("rel_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.addRelationUnified,
        expect.objectContaining({
          subjectType: "user",
          subjectId: "alice",
          relation: "member",
          objectType: "team",
          objectId: "sales",
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass caveat and createdBy options", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("rel_id"),
      };

      await authz.addRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" },
        { caveat: "time_limit", createdBy: "admin_1" }
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.addRelationUnified,
        expect.objectContaining({
          caveat: "time_limit",
          createdBy: "admin_1",
        })
      );
    });

    it("should use defaultActorId when no createdBy", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("rel_id"),
      };

      await authz.addRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.addRelationUnified,
        expect.objectContaining({ createdBy: "default_actor" })
      );
    });
  });

  describe("removeRelation", () => {
    it("should remove relation via unified.removeRelationUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.removeRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(result).toBe(true);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.removeRelationUnified,
        {
          subjectType: "user",
          subjectId: "alice",
          relation: "member",
          objectType: "team",
          objectId: "sales",
          removedBy: undefined,
          enableAudit: true,
          tenantId: "test-tenant",
        }
      );
    });
  });

  describe("recomputeUser", () => {
    it("should call unified.recomputeUser", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(null),
      };

      await authz.recomputeUser(ctx, "user_123");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.recomputeUser,
        {
          tenantId: "test-tenant",
          userId: "user_123",
          rolePermissionsMap: {
            admin: [
              "documents:create",
              "documents:read",
              "documents:update",
              "documents:delete",
            ],
            viewer: ["documents:read"],
          },
        }
      );
    });

    it("should throw for empty userId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(null),
      };

      await expect(authz.recomputeUser(ctx, "")).rejects.toThrow(
        "userId must be a non-empty string"
      );
    });
  });

  describe("syncRole", () => {
    it("should call unified.syncRoleAction with the configured rolePermissionsMap", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn(),
        runMutation: vi.fn(),
        runAction: vi.fn().mockResolvedValue({ usersProcessed: 3 }),
      };

      const result = await authz.syncRole(ctx, "admin");

      expect(result).toEqual({ usersProcessed: 3 });
      expect(ctx.runAction).toHaveBeenCalledWith(
        component.unified.syncRoleAction,
        {
          tenantId: "test-tenant",
          role: "admin",
          rolePermissionsMap: {
            admin: [
              "documents:create",
              "documents:read",
              "documents:update",
              "documents:delete",
            ],
            viewer: ["documents:read"],
          },
          policyClassifications: undefined,
        }
      );
    });

    it("should throw when role is not in the configured catalog", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn(),
        runMutation: vi.fn(),
        runAction: vi.fn(),
      };

      await expect(
        // @ts-expect-error — intentionally bypassing type check to verify runtime guard
        authz.syncRole(ctx, "nonexistent")
      ).rejects.toThrow('Role "nonexistent" not found in role catalog');
      expect(ctx.runAction).not.toHaveBeenCalled();
    });
  });

  describe("syncRoles", () => {
    it("should call syncRoleAction once per role and aggregate counts", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn(),
        runMutation: vi.fn(),
        runAction: vi
          .fn()
          .mockResolvedValueOnce({ usersProcessed: 5 }) // admin
          .mockResolvedValueOnce({ usersProcessed: 12 }), // viewer
      };

      const result = await authz.syncRoles(ctx);

      expect(result).toEqual({ rolesProcessed: 2, usersProcessed: 17 });
      expect(ctx.runAction).toHaveBeenCalledTimes(2);
    });

    it("should be a no-op when no roles are configured", async () => {
      const component = createMockComponent();
      const emptyPermissions = definePermissions({ noop: { read: true } });
      const emptyRoles = defineRoles(emptyPermissions, {});
      const authz = new Authz(component, {
        permissions: emptyPermissions,
        roles: emptyRoles,
        tenantId: "test-tenant",
      });

      const ctx = {
        runQuery: vi.fn(),
        runMutation: vi.fn(),
        runAction: vi.fn(),
      };

      const result = await authz.syncRoles(ctx);

      expect(result).toEqual({ rolesProcessed: 0, usersProcessed: 0 });
      expect(ctx.runAction).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Input validation tests
// ============================================================================

describe("input validation", () => {
  function createMockComponent() {
    return {
      queries: {
        checkPermission: "queries.checkPermission",
        checkPermissions: "queries.checkPermissions",
        hasRole: "queries.hasRole",
        getUserRoles: "queries.getUserRoles",
        getEffectivePermissions: "queries.getEffectivePermissions",
        getUserAttributes: "queries.getUserAttributes",
        getAuditLog: "queries.getAuditLog",
      },
      mutations: {
        assignRole: "mutations.assignRole",
        assignRoles: "mutations.assignRoles",
        revokeRole: "mutations.revokeRole",
        revokeRoles: "mutations.revokeRoles",
        revokeAllRoles: "mutations.revokeAllRoles",
        offboardUser: "mutations.offboardUser",
        setAttribute: "mutations.setAttribute",
        removeAttribute: "mutations.removeAttribute",
        grantPermission: "mutations.grantPermission",
        denyPermission: "mutations.denyPermission",
      },
      unified: {
        checkPermission: "unified.checkPermission",
        assignRoleUnified: "unified.assignRoleUnified",
        revokeRoleUnified: "unified.revokeRoleUnified",
        assignRolesUnified: "unified.assignRolesUnified",
        revokeRolesUnified: "unified.revokeRolesUnified",
        revokeAllRolesUnified: "unified.revokeAllRolesUnified",
        grantPermissionUnified: "unified.grantPermissionUnified",
        denyPermissionUnified: "unified.denyPermissionUnified",
        addRelationUnified: "unified.addRelationUnified",
        removeRelationUnified: "unified.removeRelationUnified",
      },
      indexed: {
        hasRoleFast: "indexed.hasRoleFast",
        hasRelationFast: "indexed.hasRelationFast",
        getUserRolesFast: "indexed.getUserRolesFast",
        getUserPermissionsFast: "indexed.getUserPermissionsFast",
      },
    } as unknown as ComponentApi;
  }

  const permissions = definePermissions({
    documents: { create: true, read: true, update: true, delete: true },
  });

  const roles = defineRoles(permissions, {
    admin: { documents: ["create", "read", "update", "delete"] },
    viewer: { documents: ["read"] },
  });

  describe("Authz", () => {
    it("throws for empty userId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok" }),
      };

      await expect(authz.can(ctx, "", "documents:read")).rejects.toThrow(
        "userId must be a non-empty string"
      );
      await expect(authz.can(ctx, "   ", "documents:read")).rejects.toThrow(
        "userId must be a non-empty string"
      );
    });

    it("throws for invalid permission format", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "ok" }),
      };

      await expect(authz.can(ctx, "user_1", "read" as any)).rejects.toThrow(
        'Invalid permission format: "read". Expected "resource:action"'
      );
      await expect(authz.can(ctx, "user_1", "a:b:c" as any)).rejects.toThrow(
        'Invalid permission format: "a:b:c". Expected "resource:action"'
      );
      await expect(authz.can(ctx, "user_1", "" as any)).rejects.toThrow(
        'Invalid permission format: "". Expected "resource:action"'
      );
    });

    it("throws for invalid scope when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok" }),
      };

      await expect(
        authz.can(ctx, "user_1", "documents:read", { type: "", id: "x" })
      ).rejects.toThrow("scope must have non-empty type when provided");

      await expect(
        authz.can(ctx, "user_1", "documents:read", { type: "t", id: "" })
      ).rejects.toThrow("scope must have non-empty id when provided");
    });

    it("throws for unknown role in assignRole and hasRole", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue(false),
        runMutation: vi.fn().mockResolvedValue("id"),
      };

      await expect(
        authz.hasRole(ctx, "user_1", "superadmin" as "admin" & string)
      ).rejects.toThrow('Unknown role: "superadmin"');

      await expect(
        authz.assignRole(ctx, "user_1", "superadmin" as "admin" & string)
      ).rejects.toThrow('Unknown role: "superadmin"');
    });

    it("throws for invalid expiresAt when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("id"),
      };

      await expect(
        authz.assignRole(ctx, "user_1", "admin", undefined, NaN)
      ).rejects.toThrow("expiresAt must be a finite number");

      await expect(
        authz.grantPermission(
          ctx,
          "user_1",
          "documents:read",
          undefined,
          undefined,
          Number.POSITIVE_INFINITY
        )
      ).rejects.toThrow("expiresAt must be a finite number");
    });

    it("throws for empty attribute key in setAttribute and removeAttribute", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runMutation: vi.fn().mockResolvedValue("id"),
      };

      await expect(
        authz.setAttribute(ctx, "user_1", "", "value")
      ).rejects.toThrow("Attribute key must be a non-empty string");

      await expect(authz.removeAttribute(ctx, "user_1", "   ")).rejects.toThrow(
        "Attribute key must be a non-empty string"
      );
    });

    it("throws for invalid getAuditLog limit when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await expect(
        authz.getAuditLog(ctx, { limit: -1 })
      ).rejects.toThrow("limit must be a positive integer when provided");

      await expect(
        authz.getAuditLog(ctx, { limit: 1.5 })
      ).rejects.toThrow("limit must be a positive integer when provided");
    });
  });

  describe("Authz (alias)", () => {
    it("throws for empty userId and invalid permission", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok", tier: "cached" }),
      };

      await expect(authz.can(ctx, "", "documents:read")).rejects.toThrow(
        "userId must be a non-empty string"
      );
      await expect(authz.can(ctx, "user_1", "read" as any)).rejects.toThrow(
        'Invalid permission format: "read". Expected "resource:action"'
      );
    });

    it("throws for unknown role and invalid scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
        runMutation: vi.fn().mockResolvedValue("id"),
      };

      await expect(
        authz.assignRole(ctx, "user_1", "superadmin" as "admin" & string)
      ).rejects.toThrow('Unknown role: "superadmin"');

      await expect(
        authz.getUserRoles(ctx, "user_1", { type: "", id: "x" })
      ).rejects.toThrow("scope must have non-empty type when provided");
    });

    it("validates relation args client-side", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });
      const ctx = {
        runQuery: vi.fn().mockResolvedValue(false),
        runMutation: vi.fn().mockResolvedValue("id"),
      };

      // addRelation and removeRelation validate relation args
      await expect(
        authz.addRelation(ctx, { type: "user", id: "alice" }, "", { type: "team", id: "sales" })
      ).rejects.toThrow();

      await expect(
        authz.removeRelation(ctx, { type: "", id: "alice" }, "member", { type: "team", id: "sales" })
      ).rejects.toThrow();
    });
  });
});

// ============================================================================
// Authz alias tests (uses Authz under the hood)
// ============================================================================

describe("Authz alias (via Authz)", () => {
  // Since Authz is now just Authz, we use the Authz-compatible mock
  function createMockComponent() {
    return {
      queries: {
        checkPermission: "queries.checkPermission",
        checkPermissions: "queries.checkPermissions",
        hasRole: "queries.hasRole",
        getUserRoles: "queries.getUserRoles",
        getEffectivePermissions: "queries.getEffectivePermissions",
        getUserAttributes: "queries.getUserAttributes",
        getAuditLog: "queries.getAuditLog",
      },
      mutations: {
        assignRole: "mutations.assignRole",
        assignRoles: "mutations.assignRoles",
        revokeRole: "mutations.revokeRole",
        revokeRoles: "mutations.revokeRoles",
        revokeAllRoles: "mutations.revokeAllRoles",
        offboardUser: "mutations.offboardUser",
        setAttribute: "mutations.setAttribute",
        removeAttribute: "mutations.removeAttribute",
        grantPermission: "mutations.grantPermission",
        denyPermission: "mutations.denyPermission",
        deprovisionUser: "mutations.deprovisionUser",
      },
      unified: {
        checkPermission: "unified.checkPermission",
        assignRoleUnified: "unified.assignRoleUnified",
        revokeRoleUnified: "unified.revokeRoleUnified",
        assignRolesUnified: "unified.assignRolesUnified",
        revokeRolesUnified: "unified.revokeRolesUnified",
        revokeAllRolesUnified: "unified.revokeAllRolesUnified",
        grantPermissionUnified: "unified.grantPermissionUnified",
        denyPermissionUnified: "unified.denyPermissionUnified",
        addRelationUnified: "unified.addRelationUnified",
        removeRelationUnified: "unified.removeRelationUnified",
        recomputeUser: "unified.recomputeUser",
        syncRoleAction: "unified.syncRoleAction",
      },
      indexed: {
        hasRoleFast: "indexed.hasRoleFast",
        hasRelationFast: "indexed.hasRelationFast",
        getUserRolesFast: "indexed.getUserRolesFast",
        getUserPermissionsFast: "indexed.getUserPermissionsFast",
      },
    } as unknown as ComponentApi;
  }

  const permissions = definePermissions({
    documents: { create: true, read: true, update: true, delete: true },
  });

  const roles = defineRoles(permissions, {
    admin: { documents: ["create", "read", "update", "delete"] },
    viewer: { documents: ["read"] },
  });

  describe("can", () => {
    it("should check permission via unified.checkPermission", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "Cached", tier: "cached" }),
      };

      const result = await authz.can(ctx, "user_123", "documents:read");
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:read",
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass scope when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "Denied", tier: "cached" }),
      };

      await authz.can(ctx, "user_123", "documents:read", {
        type: "team",
        id: "team_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          scope: { type: "team", id: "team_1" },
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("require", () => {
    it("should not throw when permission is allowed", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "Cached", tier: "cached" }),
      };

      await expect(
        authz.require(ctx, "user_123", "documents:read")
      ).resolves.not.toThrow();
    });

    it("should throw when permission is denied", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "Denied", tier: "cached" }),
      };

      await expect(
        authz.require(ctx, "user_123", "documents:delete")
      ).rejects.toThrow("Permission denied: documents:delete");
    });

    it("should include scope in error message", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue({ allowed: false, reason: "Denied", tier: "cached" }),
      };

      await expect(
        authz.require(ctx, "user_123", "documents:delete", {
          type: "doc",
          id: "doc_1",
        })
      ).rejects.toThrow("Permission denied: documents:delete on doc:doc_1");
    });
  });

  describe("hasRole", () => {
    it("should check role via indexed.hasRoleFast", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.hasRole(ctx, "user_123", "admin");
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.hasRoleFast,
        {
          userId: "user_123",
          role: "admin",
          objectType: undefined,
          objectId: undefined,
          tenantId: "test-tenant",
        }
      );
    });

    it("should pass scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(false),
      };

      await authz.hasRole(ctx, "user_123", "admin", {
        type: "org",
        id: "org_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.hasRoleFast,
        expect.objectContaining({
          objectType: "org",
          objectId: "org_1",
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("hasRelation", () => {
    it("should check relation via indexed.hasRelationFast", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.hasRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(result).toBe(true);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.hasRelationFast,
        {
          subjectType: "user",
          subjectId: "alice",
          relation: "member",
          objectType: "team",
          objectId: "sales",
          tenantId: "test-tenant",
        }
      );
    });
  });

  describe("getUserPermissions", () => {
    it("should get permissions without scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getUserPermissions(ctx, "user_123");
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserPermissionsFast,
        { userId: "user_123", scopeKey: undefined, tenantId: "test-tenant" }
      );
    });

    it("should get permissions with scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getUserPermissions(ctx, "user_123", {
        type: "team",
        id: "team_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserPermissionsFast,
        { userId: "user_123", scopeKey: "team:team_1", tenantId: "test-tenant" }
      );
    });
  });

  describe("getUserRoles", () => {
    it("should get roles without scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getUserRoles(ctx, "user_123");
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserRolesFast,
        { userId: "user_123", scopeKey: undefined, tenantId: "test-tenant" }
      );
    });

    it("should get roles with scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn().mockResolvedValue([]),
      };

      await authz.getUserRoles(ctx, "user_123", {
        type: "org",
        id: "org_1",
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.indexed.getUserRolesFast,
        { userId: "user_123", scopeKey: "org:org_1", tenantId: "test-tenant" }
      );
    });
  });

  describe("assignRole", () => {
    it("should assign role via unified.assignRoleUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("role_id"),
      };

      const result = await authz.assignRole(ctx, "user_123", "admin");
      expect(result).toBe("role_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({
          userId: "user_123",
          role: "admin",
          rolePermissions: [
            "documents:create",
            "documents:read",
            "documents:update",
            "documents:delete",
          ],
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass scope and expiresAt", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("role_id"),
      };

      const scope = { type: "team", id: "team_1" };
      const expiresAt = Date.now() + 3600000;

      await authz.assignRole(ctx, "user_123", "admin", scope, expiresAt);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({ scope, expiresAt, tenantId: "test-tenant" })
      );
    });

    it("should use assignedBy when provided", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("role_id"),
      };

      await authz.assignRole(
        ctx,
        "user_123",
        "admin",
        undefined,
        undefined,
        "actor_1"
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({ assignedBy: "actor_1", tenantId: "test-tenant" })
      );
    });

    it("should use defaultActorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("role_id"),
      };

      await authz.assignRole(ctx, "user_123", "admin");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRoleUnified,
        expect.objectContaining({ assignedBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("revokeRole", () => {
    it("should revoke role via unified.revokeRoleUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.revokeRole(ctx, "user_123", "admin");
      expect(result).toBe(true);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRoleUnified,
        expect.objectContaining({
          userId: "user_123",
          role: "admin",
          rolePermissions: [
            "documents:create",
            "documents:read",
            "documents:update",
            "documents:delete",
          ],
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass scope", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      await authz.revokeRole(ctx, "user_123", "admin", {
        type: "team",
        id: "team_1",
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRoleUnified,
        expect.objectContaining({
          scope: { type: "team", id: "team_1" },
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("canAny", () => {
    it("should call can() for each permission and return true if any allowed", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runQuery: vi.fn()
          .mockResolvedValueOnce({ allowed: true, reason: "Allowed", tier: "cached" }),
      };

      const result = await authz.canAny(ctx, "user_123", [
        "documents:read",
        "documents:delete",
      ]);
      expect(result).toBe(true);
      // Should short-circuit after first allowed permission
      expect(ctx.runQuery).toHaveBeenCalledTimes(1);
      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.unified.checkPermission,
        expect.objectContaining({
          userId: "user_123",
          permission: "documents:read",
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("assignRoles", () => {
    it("should call runMutation with assignRolesUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue({
          assigned: 2,
          assignmentIds: ["id1", "id2"],
        }),
      };

      const result = await authz.assignRoles(ctx, "user_123", [
        { role: "admin" },
        { role: "viewer" },
      ]);
      expect(result.assigned).toBe(2);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.assignRolesUnified,
        expect.objectContaining({
          userId: "user_123",
          roles: expect.any(Array),
          rolePermissionsMap: expect.any(Object),
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("revokeRoles", () => {
    it("should call runMutation with revokeRolesUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue({ revoked: 2 }),
      };

      const result = await authz.revokeRoles(ctx, "user_123", [
        { role: "admin" },
        { role: "viewer" },
      ]);
      expect(result.revoked).toBe(2);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeRolesUnified,
        expect.objectContaining({
          userId: "user_123",
          roles: expect.any(Array),
          rolePermissionsMap: expect.any(Object),
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("revokeAllRoles", () => {
    it("should call revokeAllRolesUnified mutation", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(3),
      };

      const result = await authz.revokeAllRoles(ctx, "user_123");
      expect(result).toBe(3);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.revokeAllRolesUnified,
        expect.objectContaining({
          userId: "user_123",
          scope: undefined,
          rolePermissionsMap: expect.any(Object),
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("offboardUser", () => {
    it("should call runMutation with offboardUser", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue({
          rolesRevoked: 1,
          overridesRemoved: 0,
          attributesRemoved: 0,
          effectiveRolesRemoved: 1,
          effectivePermissionsRemoved: 3,
        }),
      };

      const result = await authz.offboardUser(ctx, "user_123");
      expect(result.rolesRevoked).toBe(1);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.mutations.offboardUser,
        expect.objectContaining({
          userId: "user_123",
          enableAudit: true,
          tenantId: "test-tenant",
        })
      );
    });
  });

  describe("grantPermission", () => {
    it("should grant permission via unified.grantPermissionUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("perm_id"),
      };

      const result = await authz.grantPermission(
        ctx,
        "user_123",
        "documents:read"
      );
      expect(result).toBe("perm_id");
    });

    it("should pass all optional parameters", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("perm_id"),
      };

      const scope = { type: "doc", id: "doc_1" };
      const expiresAt = Date.now() + 3600000;

      await authz.grantPermission(
        ctx,
        "user_123",
        "documents:read",
        scope,
        "Reason",
        expiresAt,
        "actor_1"
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({
          scope,
          reason: "Reason",
          expiresAt,
          createdBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("perm_id"),
      };

      await authz.grantPermission(ctx, "user_123", "documents:read");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.grantPermissionUnified,
        expect.objectContaining({ createdBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("denyPermission", () => {
    it("should deny permission via unified.denyPermissionUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("perm_id"),
      };

      const result = await authz.denyPermission(
        ctx,
        "user_123",
        "documents:delete"
      );
      expect(result).toBe("perm_id");
    });

    it("should pass all optional parameters", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("perm_id"),
      };

      const scope = { type: "doc", id: "doc_1" };
      const expiresAt = Date.now() + 3600000;

      await authz.denyPermission(
        ctx,
        "user_123",
        "documents:delete",
        scope,
        "Security",
        expiresAt,
        "actor_1"
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({
          scope,
          reason: "Security",
          expiresAt,
          createdBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("perm_id"),
      };

      await authz.denyPermission(ctx, "user_123", "documents:delete");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.denyPermissionUnified,
        expect.objectContaining({ createdBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("addRelation", () => {
    it("should add relation via unified.addRelationUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("rel_id"),
      };

      const result = await authz.addRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(result).toBe("rel_id");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.addRelationUnified,
        expect.objectContaining({
          subjectType: "user",
          subjectId: "alice",
          relation: "member",
          objectType: "team",
          objectId: "sales",
          tenantId: "test-tenant",
        })
      );
    });

    it("should pass caveat and createdBy options", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("rel_id"),
      };

      await authz.addRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" },
        { caveat: "time_limit", createdBy: "actor_1" }
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.addRelationUnified,
        expect.objectContaining({
          caveat: "time_limit",
          createdBy: "actor_1",
          tenantId: "test-tenant",
        })
      );
    });

    it("should use defaultActorId when no createdBy", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, {
        permissions,
        roles,
        defaultActorId: "default_actor",
        tenantId: "test-tenant",
      });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue("rel_id"),
      };

      await authz.addRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.addRelationUnified,
        expect.objectContaining({ createdBy: "default_actor", tenantId: "test-tenant" })
      );
    });
  });

  describe("removeRelation", () => {
    it("should remove relation via unified.removeRelationUnified", async () => {
      const component = createMockComponent();
      const authz = new Authz(component, { permissions, roles, tenantId: "test-tenant" });

      const ctx = {
        runMutation: vi.fn().mockResolvedValue(true),
      };

      const result = await authz.removeRelation(
        ctx,
        { type: "user", id: "alice" },
        "member",
        { type: "team", id: "sales" }
      );
      expect(result).toBe(true);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        component.unified.removeRelationUnified,
        {
          subjectType: "user",
          subjectId: "alice",
          relation: "member",
          objectType: "team",
          objectId: "sales",
          removedBy: undefined,
          enableAudit: true,
          tenantId: "test-tenant",
        }
      );
    });
  });
});

// ============================================================================
// withTenant() and constructor validation tests
// ============================================================================

describe("Authz withTenant()", () => {
  function createMockComponent() {
    return {
      queries: {
        checkPermission: "queries.checkPermission",
        checkPermissions: "queries.checkPermissions",
        hasRole: "queries.hasRole",
        getUserRoles: "queries.getUserRoles",
        getEffectivePermissions: "queries.getEffectivePermissions",
        getUserAttributes: "queries.getUserAttributes",
        getAuditLog: "queries.getAuditLog",
      },
      mutations: {
        assignRole: "mutations.assignRole",
        assignRoles: "mutations.assignRoles",
        revokeRole: "mutations.revokeRole",
        revokeRoles: "mutations.revokeRoles",
        revokeAllRoles: "mutations.revokeAllRoles",
        offboardUser: "mutations.offboardUser",
        setAttribute: "mutations.setAttribute",
        removeAttribute: "mutations.removeAttribute",
        grantPermission: "mutations.grantPermission",
        denyPermission: "mutations.denyPermission",
      },
      unified: {
        checkPermission: "unified.checkPermission",
      },
    } as unknown as ComponentApi;
  }

  const permissions = definePermissions({
    documents: { create: true, read: true, update: true, delete: true },
  });

  const roles = defineRoles(permissions, {
    admin: { documents: ["create", "read", "update", "delete"] },
    viewer: { documents: ["read"] },
  });

  it("should return a new instance scoped to a different tenant", async () => {
    const component = createMockComponent();
    const authz = new Authz(component, { permissions, roles, tenantId: "tenant-a" });
    const other = authz.withTenant("tenant-b");

    const ctx = {
      runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok", tier: "cached" }),
    };
    await other.can(ctx, "user1", "documents:read");

    expect(ctx.runQuery).toHaveBeenCalledWith(
      "unified.checkPermission",
      expect.objectContaining({ tenantId: "tenant-b" })
    );
  });

  it("should not modify the original instance", async () => {
    const component = createMockComponent();
    const authz = new Authz(component, { permissions, roles, tenantId: "tenant-a" });
    authz.withTenant("tenant-b");

    const ctx = {
      runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok", tier: "cached" }),
    };
    await authz.can(ctx, "user1", "documents:read");

    expect(ctx.runQuery).toHaveBeenCalledWith(
      "unified.checkPermission",
      expect.objectContaining({ tenantId: "tenant-a" })
    );
  });

  it("should throw for empty tenantId", () => {
    const component = createMockComponent();
    const authz = new Authz(component, { permissions, roles, tenantId: "tenant-a" });

    expect(() => authz.withTenant("")).toThrow("tenantId must be a non-empty string");
    expect(() => authz.withTenant("   ")).toThrow("tenantId must be a non-empty string");
  });
});

describe("Authz constructor validation", () => {
  const permissions = definePermissions({ documents: { read: true } });
  const roles = defineRoles(permissions, { viewer: { documents: ["read"] } });

  it("should throw for missing tenantId", () => {
    const component = {} as unknown as ComponentApi;
    expect(
      () => new Authz(component, { permissions, roles, tenantId: "" })
    ).toThrow("tenantId must be a non-empty string");
  });

  it("should throw for whitespace-only tenantId", () => {
    const component = {} as unknown as ComponentApi;
    expect(
      () => new Authz(component, { permissions, roles, tenantId: "   " })
    ).toThrow("tenantId must be a non-empty string");
  });

  it("should accept a valid tenantId", () => {
    const component = {} as unknown as ComponentApi;
    expect(
      () => new Authz(component, { permissions, roles, tenantId: "my-tenant" })
    ).not.toThrow();
  });
});

describe("Authz (alias) withTenant()", () => {
  function createMockComponent() {
    return {
      queries: {
        checkPermission: "queries.checkPermission",
        checkPermissions: "queries.checkPermissions",
        getUserAttributes: "queries.getUserAttributes",
        getAuditLog: "queries.getAuditLog",
      },
      mutations: {
        offboardUser: "mutations.offboardUser",
        deprovisionUser: "mutations.deprovisionUser",
      },
      unified: {
        checkPermission: "unified.checkPermission",
      },
      indexed: {
        hasRoleFast: "indexed.hasRoleFast",
        hasRelationFast: "indexed.hasRelationFast",
        getUserRolesFast: "indexed.getUserRolesFast",
        getUserPermissionsFast: "indexed.getUserPermissionsFast",
      },
    } as unknown as ComponentApi;
  }

  const permissions = definePermissions({
    documents: { create: true, read: true, update: true, delete: true },
  });

  const roles = defineRoles(permissions, {
    admin: { documents: ["create", "read", "update", "delete"] },
    viewer: { documents: ["read"] },
  });

  it("should return a new instance scoped to a different tenant", async () => {
    const component = createMockComponent();
    const authz = new Authz(component, { permissions, roles, tenantId: "tenant-a" });
    const other = authz.withTenant("tenant-b");

    const ctx = {
      runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok", tier: "cached" }),
    };
    await other.can(ctx, "user1", "documents:read");

    expect(ctx.runQuery).toHaveBeenCalledWith(
      "unified.checkPermission",
      expect.objectContaining({ tenantId: "tenant-b" })
    );
  });

  it("should not modify the original instance", async () => {
    const component = createMockComponent();
    const authz = new Authz(component, { permissions, roles, tenantId: "tenant-a" });
    authz.withTenant("tenant-b");

    const ctx = {
      runQuery: vi.fn().mockResolvedValue({ allowed: true, reason: "ok", tier: "cached" }),
    };
    await authz.can(ctx, "user1", "documents:read");

    expect(ctx.runQuery).toHaveBeenCalledWith(
      "unified.checkPermission",
      expect.objectContaining({ tenantId: "tenant-a" })
    );
  });

  it("should throw for empty tenantId", () => {
    const component = createMockComponent();
    const authz = new Authz(component, { permissions, roles, tenantId: "tenant-a" });

    expect(() => authz.withTenant("")).toThrow("tenantId must be a non-empty string");
    expect(() => authz.withTenant("   ")).toThrow("tenantId must be a non-empty string");
  });
});

describe("Authz (alias) constructor validation", () => {
  const permissions = definePermissions({ documents: { read: true } });
  const roles = defineRoles(permissions, { viewer: { documents: ["read"] } });

  it("should throw for missing tenantId", () => {
    const component = {} as unknown as ComponentApi;
    expect(
      () => new Authz(component, { permissions, roles, tenantId: "" })
    ).toThrow("tenantId must be a non-empty string");
  });

  it("should accept a valid tenantId", () => {
    const component = {} as unknown as ComponentApi;
    expect(
      () => new Authz(component, { permissions, roles, tenantId: "my-tenant" })
    ).not.toThrow();
  });
});

// ============================================================================
// v2 constructor options and definition helpers
// ============================================================================

describe("v2 constructor options and definition helpers", () => {
  const permissions = definePermissions({ documents: { read: true, write: true } });
  const roles = defineRoles(permissions, { viewer: { documents: ["read"] } });

  it("Authz accepts v2 constructor options", () => {
    const component = {} as unknown as ComponentApi;
    const relationPermissions = defineRelationPermissions({
      owner: ["documents:read", "documents:write"],
    });

    expect(
      () =>
        new Authz(component, {
          permissions,
          roles,
          tenantId: "my-tenant",
          relationPermissions,
        })
    ).not.toThrow();
  });

  it("defineTraversalRules returns rules", () => {
    const rules = {
      user: [{ through: "member", via: "group", inherit: "viewer" }],
    };
    expect(defineTraversalRules(rules)).toBe(rules);
  });

  it("defineRelationPermissions returns map", () => {
    const map = {
      owner: ["documents:read", "documents:write"],
      viewer: ["documents:read"],
    };
    expect(defineRelationPermissions(map)).toBe(map);
  });

  it("defineCaveats returns caveats", () => {
    const caveats = {
      isOwner: ({ subject, object }: { subject: { type: string; id: string }; object: { type: string; id: string }; relation: string; caveatContext: unknown }) =>
        subject.id === object.id,
    };
    expect(defineCaveats(caveats)).toBe(caveats);
  });

  it("PolicyDefinition supports type field", () => {
    const policies: PolicyDefinition = {
      expensiveCheck: {
        type: "deferred",
        condition: async (ctx) => ctx.subject.roles.includes("admin"),
        message: "Must be admin",
      },
      quickCheck: {
        type: "static",
        condition: (ctx) => ctx.subject.roles.length > 0,
      },
      defaultCheck: {
        // no type field — defaults to "static"
        condition: () => true,
      },
    };

    expect(policies.expensiveCheck.type).toBe("deferred");
    expect(policies.quickCheck.type).toBe("static");
    expect(policies.defaultCheck.type).toBeUndefined();
  });
});
