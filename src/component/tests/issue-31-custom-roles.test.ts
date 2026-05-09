/**
 * End-to-end scenario tests for issue #31 — tenant-defined custom roles.
 *
 * Verifies the full lifecycle (create → assign → can() → update + cascade →
 * revoke → delete) plus cross-tenant isolation invariants. This file
 * complements the unit tests in:
 *   - customRoles.test.ts          (CRUD + whitelist + cap)
 *   - customRoleAssignment.test.ts (assign/revoke + composition)
 *   - customRoleCascade.test.ts    (update fan-out + recompute correctness)
 *   - tenant-isolation.test.ts     (existing system-role tenant isolation)
 *
 * Treat as the "do these all work together?" smoke suite for the feature.
 */

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import schema from "../schema.js";
import { api } from "../_generated/api.js";
import { customRoleStringFromId } from "../customRoles.js";

const modules = import.meta.glob("../**/*.ts");

const TENANT_A = "tenant-acme";
const TENANT_B = "tenant-globex";
const ADMIN_A = "admin-A";
const ADMIN_B = "admin-B";
const GRANTABLE = ["docs:read", "docs:write", "docs:delete"];

describe("issue #31 — custom roles end-to-end", () => {
  it("full lifecycle in a single tenant: create → assign → can → update → revoke → delete", async () => {
    const t = convexTest(schema, modules);

    // 1. Create
    const roleId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
      enableAudit: true,
    });

    // 2. Assign to user
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: "u1",
      customRoleId: roleId,
      assignedBy: ADMIN_A,
      enableAudit: true,
    });

    // 3. can() works
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: "u1",
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(true);

    // 4. Update — add docs:write
    const result = await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: roleId,
      permissions: ["docs:read", "docs:write"],
      grantablePermissions: GRANTABLE,
      rolePermissionsMap: {},
      actorId: ADMIN_A,
      enableAudit: true,
    });
    expect(result.permissionsChanged).toBe(true);
    expect(result.usersRecomputed).toBe(1);

    // 4a. New permission applied
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: "u1",
          permission: "docs:write",
        })
      ).allowed,
    ).toBe(true);

    // 5. Revoke
    expect(
      await t.mutation(api.unified.revokeCustomRoleUnified, {
        tenantId: TENANT_A,
        userId: "u1",
        customRoleId: roleId,
        revokedBy: ADMIN_A,
        enableAudit: true,
      }),
    ).toBe(true);

    // 5a. Permissions gone
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: "u1",
          permission: "docs:write",
        })
      ).allowed,
    ).toBe(false);

    // 6. Delete (no users hold it now → no force needed)
    const del = await t.mutation(api.customRoles.deleteCustomRole, {
      customRoleId: roleId,
      tenantId: TENANT_A,
      actorId: ADMIN_A,
      enableAudit: true,
    });
    expect(del.deleted).toBe(true);
    expect(del.assignmentsRevoked).toBe(0);

    // 7. Audit log carries the full lifecycle
    const logsResult = await t.query(api.queries.getAuditLog, {
      tenantId: TENANT_A,
    });
    const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("custom_role_created");
    expect(actions).toContain("role_assigned");
    expect(actions).toContain("custom_role_updated");
    expect(actions).toContain("role_revoked");
    expect(actions).toContain("custom_role_deleted");
  });

  it("custom roles in tenant A are invisible to tenant B", async () => {
    const t = convexTest(schema, modules);

    const aId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read", "docs:write"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
    });

    // Direct lookup from B returns null
    expect(
      await t.query(api.customRoles.getCustomRole, {
        customRoleId: aId,
        tenantId: TENANT_B,
      }),
    ).toBeNull();

    // List from B is empty
    const listB = await t.query(api.customRoles.listCustomRoles, {
      tenantId: TENANT_B,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(listB.page).toHaveLength(0);

    // Same name lookup in B returns null
    expect(
      await t.query(api.customRoles.getCustomRoleByName, {
        tenantId: TENANT_B,
        name: "Editor",
      }),
    ).toBeNull();
  });

  it("assigning tenant A's custom role from tenant B context throws", async () => {
    const t = convexTest(schema, modules);

    const aId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
    });

    await expect(
      t.mutation(api.unified.assignCustomRoleUnified, {
        tenantId: TENANT_B,
        userId: "u1",
        customRoleId: aId,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("identical role names in different tenants are independent", async () => {
    const t = convexTest(schema, modules);

    const aId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
    });
    const bId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_B,
      name: "Editor", // same name, different tenant
      permissions: ["docs:read", "docs:write"], // different permissions
      createdBy: ADMIN_B,
      grantablePermissions: GRANTABLE,
    });

    expect(aId).not.toBe(bId);

    // Each user gets the right permissions
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: "alice",
      customRoleId: aId,
    });
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_B,
      userId: "bob",
      customRoleId: bId,
    });

    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: "alice",
          permission: "docs:write",
        })
      ).allowed,
    ).toBe(false); // alice's "Editor" doesn't grant write

    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_B,
          userId: "bob",
          permission: "docs:write",
        })
      ).allowed,
    ).toBe(true); // bob's "Editor" does
  });

  it("update in tenant A does not affect users in tenant B", async () => {
    const t = convexTest(schema, modules);

    const aId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
    });
    const bId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_B,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_B,
      grantablePermissions: GRANTABLE,
    });

    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: "alice",
      customRoleId: aId,
    });
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_B,
      userId: "bob",
      customRoleId: bId,
    });

    // Add docs:write to tenant A's role only
    await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: aId,
      permissions: ["docs:read", "docs:write"],
      grantablePermissions: GRANTABLE,
      rolePermissionsMap: {},
    });

    // alice gets the new permission
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: "alice",
          permission: "docs:write",
        })
      ).allowed,
    ).toBe(true);

    // bob does NOT — his tenant's "Editor" was untouched
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_B,
          userId: "bob",
          permission: "docs:write",
        })
      ).allowed,
    ).toBe(false);
  });

  it("force-deleting a role in tenant A does not affect tenant B's same-named role", async () => {
    const t = convexTest(schema, modules);

    const aId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
    });
    const bId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_B,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_B,
      grantablePermissions: GRANTABLE,
    });

    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: "alice",
      customRoleId: aId,
    });
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_B,
      userId: "bob",
      customRoleId: bId,
    });

    // Force-delete tenant A's role
    await t.mutation(api.customRoles.deleteCustomRole, {
      customRoleId: aId,
      tenantId: TENANT_A,
      force: true,
    });

    // alice loses access; bob keeps it
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_A,
          userId: "alice",
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(false);
    expect(
      (
        await t.query(api.unified.checkPermission, {
          tenantId: TENANT_B,
          userId: "bob",
          permission: "docs:read",
        })
      ).allowed,
    ).toBe(true);

    // tenant B's role still exists
    expect(
      await t.query(api.customRoles.getCustomRole, {
        customRoleId: bId,
        tenantId: TENANT_B,
      }),
    ).not.toBeNull();
  });

  it("listCustomRoles paginates correctly with multiple tenants present", async () => {
    const t = convexTest(schema, modules);

    for (let i = 0; i < 12; i++) {
      await t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: `Role A-${i}`,
        permissions: ["docs:read"],
        createdBy: ADMIN_A,
        grantablePermissions: GRANTABLE,
      });
    }
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_B,
        name: `Role B-${i}`,
        permissions: ["docs:read"],
        createdBy: ADMIN_B,
        grantablePermissions: GRANTABLE,
      });
    }

    // First page from tenant A — only tenant-A rows
    const pageA1 = await t.query(api.customRoles.listCustomRoles, {
      tenantId: TENANT_A,
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(pageA1.page).toHaveLength(5);
    for (const row of pageA1.page) expect(row.tenantId).toBe(TENANT_A);

    // Walk to the end of tenant A's pages — total should be 12
    let cursor: string | null = pageA1.continueCursor;
    let total = pageA1.page.length;
    while (true) {
      const next = await t.query(api.customRoles.listCustomRoles, {
        tenantId: TENANT_A,
        paginationOpts: { numItems: 5, cursor },
      });
      total += next.page.length;
      for (const row of next.page) expect(row.tenantId).toBe(TENANT_A);
      if (next.isDone) break;
      cursor = next.continueCursor;
    }
    expect(total).toBe(12);

    // Counts agree
    expect(
      await t.query(api.customRoles.countCustomRoles, { tenantId: TENANT_A }),
    ).toBe(12);
    expect(
      await t.query(api.customRoles.countCustomRoles, { tenantId: TENANT_B }),
    ).toBe(5);
  });

  it("namespaced role string is stable across tenants — collision is not possible", async () => {
    const t = convexTest(schema, modules);

    const aId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_A,
      grantablePermissions: GRANTABLE,
    });
    const bId = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_B,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_B,
      grantablePermissions: GRANTABLE,
    });

    // Different ids → different namespaced role strings
    expect(customRoleStringFromId(aId)).not.toBe(customRoleStringFromId(bId));

    // hasRole only matches inside its own tenant
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: "alice",
      customRoleId: aId,
    });

    expect(
      await t.query(api.indexed.hasRoleFast, {
        tenantId: TENANT_A,
        userId: "alice",
        role: customRoleStringFromId(aId),
      }),
    ).toBe(true);

    // Same role string lookup in TENANT_B is false (no assignment there)
    expect(
      await t.query(api.indexed.hasRoleFast, {
        tenantId: TENANT_B,
        userId: "alice",
        role: customRoleStringFromId(aId),
      }),
    ).toBe(false);
  });
});
