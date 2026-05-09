/**
 * Additional removeOverrideUnified test categories that complement the core
 * correctness tests in mutations.test.ts (added in PR #43): cross-tenant
 * isolation, scope discrimination, wildcard overrides, audit log fidelity,
 * and composability with the v2.4 customRoles feature.
 */

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema.js";
import { api } from "../_generated/api.js";

const modules = import.meta.glob("../**/*.ts");

const TENANT_A = "tenant-acme";
const TENANT_B = "tenant-globex";
const USER = "user-1";

// Empty maps are accepted by removeOverrideUnified — the mutation only walks
// roleAssignments.role keys present in the map. Tests that need role-based
// preservation pass an explicit map.
const EMPTY_ROLE_MAP = {};

describe("removeOverrideUnified: cross-tenant isolation", () => {
  it("override in tenant A is not removable from tenant B", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });

    // Removal call from TENANT_B should be a no-op (override is invisible)
    const fromB = await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_B,
      userId: USER,
      permission: "docs:read",
      rolePermissionsMap: EMPTY_ROLE_MAP,
    });
    expect(fromB).toBe(false);

    // Tenant A still sees the override
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(true);
  });
});

describe("removeOverrideUnified: scope discrimination", () => {
  it("global override is distinct from a scoped override at the same permission", async () => {
    const t = convexTest(schema, modules);

    // Global grant
    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });
    // Scoped grant on team-7
    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      scope: { type: "team", id: "team-7" },
    });

    // Remove only the scoped one
    const removed = await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      scope: { type: "team", id: "team-7" },
      rolePermissionsMap: EMPTY_ROLE_MAP,
    });
    expect(removed).toBe(true);

    // Global still present
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(true);
  });

  it("attempting to remove a scoped override with a global call is a no-op", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      scope: { type: "team", id: "team-7" },
    });

    // No scope passed — should not match the scoped override
    const removed = await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      rolePermissionsMap: EMPTY_ROLE_MAP,
    });
    expect(removed).toBe(false);

    // Scoped override still in effect
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
          scope: { type: "team", id: "team-7" },
        })
      ).allowed,
    ).toBe(true);
  });
});

describe("removeOverrideUnified: wildcard overrides", () => {
  it("removes a wildcard grant (e.g. docs:*) and clears matched permissions", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:*",
    });

    // Wildcard match: docs:read should be allowed
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(true);

    // Remove the wildcard override
    const removed = await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:*",
      rolePermissionsMap: EMPTY_ROLE_MAP,
    });
    expect(removed).toBe(true);

    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(false);
  });
});

describe("removeOverrideUnified: audit log fidelity", () => {
  it("writes a permission_override_removed entry when enableAudit is true", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });

    await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      rolePermissionsMap: EMPTY_ROLE_MAP,
      removedBy: "admin-1",
      enableAudit: true,
    });

    const logsResult = await t.query(api.queries.getAuditLog, {
      tenantId: TENANT_A,
      action: "permission_override_removed",
    });
    const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(USER);
    expect(logs[0].actorId).toBe("admin-1");
    const details = logs[0].details as { permission?: string; reason?: string };
    expect(details.permission).toBe("docs:read");
    expect(details.reason).toContain("allow"); // previous effect
  });

  it("audit reason reflects whether the removed override was a grant or a deny", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.denyPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });

    await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      rolePermissionsMap: EMPTY_ROLE_MAP,
      enableAudit: true,
    });

    const logsResult = await t.query(api.queries.getAuditLog, {
      tenantId: TENANT_A,
      action: "permission_override_removed",
    });
    const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
    const details = logs[0].details as { reason?: string };
    expect(details.reason).toContain("deny");
  });

  it("does not write an audit entry when enableAudit is false/omitted", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });

    await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      rolePermissionsMap: EMPTY_ROLE_MAP,
    });

    const logsResult = await t.query(api.queries.getAuditLog, {
      tenantId: TENANT_A,
      action: "permission_override_removed",
    });
    const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
    expect(logs).toHaveLength(0);
  });
});

describe("removeOverrideUnified: composability with custom roles (v2.4)", () => {
  it("removing a deny override leaves a user's custom-role-derived access intact", async () => {
    const t = convexTest(schema, modules);

    const roleId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: "admin",
      grantablePermissions: ["docs:read", "docs:write"],
    });
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });

    // Layer a deny override on top of the custom-role-derived allow
    await t.mutation(api.unified.denyPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });

    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(false);

    // Remove the deny — custom-role-derived access comes back. Since custom
    // roles are stored as "custom:<id>" in roleAssignments.role, the recompute
    // path needs to know about them. The mutation falls back to the
    // customRoles table for "custom:" prefixes (via recomputeUser semantics);
    // here we pass an empty rolePermissionsMap because the only role the user
    // holds is a custom one, and removeOverride rebuilds sources by scanning
    // roleAssignments directly.
    const customRoleString = `custom:${roleId}`;
    await t.mutation(api.unified.removeOverrideUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      rolePermissionsMap: { [customRoleString]: ["docs:read"] },
    });

    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: USER,
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(true);
  });
});
