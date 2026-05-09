import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema.js";
import { api } from "../_generated/api.js";

const modules = import.meta.glob("../**/*.ts");

const TENANT_A = "tenant-acme";
const ADMIN = "admin-1";
const GRANTABLE = ["docs:read", "docs:write", "docs:archive", "docs:delete"];

async function setupRoleAndUsers(
  t: ReturnType<typeof convexTest>,
  initialPerms: string[],
  userIds: string[],
) {
  const roleId = await t.mutation(api.customRoles.createCustomRole, {
    tenantId: TENANT_A,
    name: "Editor",
    permissions: initialPerms,
    createdBy: ADMIN,
    grantablePermissions: GRANTABLE,
  });
  for (const userId of userIds) {
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId,
      customRoleId: roleId,
    });
  }
  return roleId;
}

describe("updateCustomRoleAction: cascade-on-update fan-out", () => {
  it("propagates added permissions to all assigned users", async () => {
    const t = convexTest(schema, modules);
    const users = ["user-1", "user-2", "user-3"];
    const roleId = await setupRoleAndUsers(t, ["docs:read"], users);

    // Sanity: nobody can write yet
    for (const u of users) {
      const r = await t.query(api.unified.checkPermission, {
        tenantId: TENANT_A,
        userId: u,
        permission: "docs:write",
      });
      expect(r.allowed).toBe(false);
    }

    const result = await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: roleId,
      permissions: ["docs:read", "docs:write"],
      grantablePermissions: GRANTABLE,
      rolePermissionsMap: {},
    });

    expect(result.permissionsChanged).toBe(true);
    expect(result.usersRecomputed).toBe(3);

    // All three users now can write
    for (const u of users) {
      const r = await t.query(api.unified.checkPermission, {
        tenantId: TENANT_A,
        userId: u,
        permission: "docs:write",
      });
      expect(r.allowed).toBe(true);
    }
  });

  it("propagates removed permissions to all assigned users", async () => {
    const t = convexTest(schema, modules);
    const users = ["user-1", "user-2"];
    const roleId = await setupRoleAndUsers(
      t,
      ["docs:read", "docs:write"],
      users,
    );

    // Sanity: both can write
    for (const u of users) {
      const r = await t.query(api.unified.checkPermission, {
        tenantId: TENANT_A,
        userId: u,
        permission: "docs:write",
      });
      expect(r.allowed).toBe(true);
    }

    await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: roleId,
      permissions: ["docs:read"],
      grantablePermissions: GRANTABLE,
      rolePermissionsMap: {},
    });

    // Nobody can write anymore; everyone still reads
    for (const u of users) {
      const w = await t.query(api.unified.checkPermission, {
        tenantId: TENANT_A,
        userId: u,
        permission: "docs:write",
      });
      expect(w.allowed).toBe(false);

      const r = await t.query(api.unified.checkPermission, {
        tenantId: TENANT_A,
        userId: u,
        permission: "docs:read",
      });
      expect(r.allowed).toBe(true);
    }
  });

  it("skips fan-out (usersRecomputed=0) when permissions are unchanged", async () => {
    const t = convexTest(schema, modules);
    const roleId = await setupRoleAndUsers(t, ["docs:read", "docs:write"], [
      "user-1",
    ]);

    const result = await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: roleId,
      permissions: ["docs:write", "docs:read"], // reordered = same set
      grantablePermissions: GRANTABLE,
      rolePermissionsMap: {},
    });

    expect(result.permissionsChanged).toBe(false);
    expect(result.usersRecomputed).toBe(0);
  });

  it("preserves direct permission grants across cascade", async () => {
    const t = convexTest(schema, modules);
    const roleId = await setupRoleAndUsers(t, ["docs:read"], ["user-1"]);

    // Direct grant unrelated to the custom role
    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "docs:archive",
      createdBy: ADMIN,
    });

    // Update custom role permissions
    await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: roleId,
      permissions: ["docs:read", "docs:write"],
      grantablePermissions: GRANTABLE,
      rolePermissionsMap: {},
    });

    // Direct grant survives the recompute
    const archive = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "docs:archive",
    });
    expect(archive.allowed).toBe(true);

    // Old role permission still there
    const read = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "docs:read",
    });
    expect(read.allowed).toBe(true);

    // New permission applied
    const write = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "docs:write",
    });
    expect(write.allowed).toBe(true);
  });

  it("preserves system role permissions when cascading a custom role update", async () => {
    const t = convexTest(schema, modules);
    const roleId = await setupRoleAndUsers(t, ["docs:read"], ["user-1"]);

    // Add a system role too
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT_A,
      userId: "user-1",
      role: "billing_admin",
      rolePermissions: ["billing:read"],
    });

    // Cascade an update to the custom role — system roles need to survive
    await t.action(api.customRoles.updateCustomRoleAction, {
      tenantId: TENANT_A,
      customRoleId: roleId,
      permissions: ["docs:read", "docs:write"],
      grantablePermissions: GRANTABLE,
      // Pass the system role permissions map so recomputeUser preserves them
      rolePermissionsMap: { billing_admin: ["billing:read"] },
    });

    // System role permission preserved
    const billing = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "billing:read",
    });
    expect(billing.allowed).toBe(true);

    // New custom role permission applied
    const write = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "docs:write",
    });
    expect(write.allowed).toBe(true);
  });

  it("recomputeUser internally resolves custom roles when not in the map", async () => {
    const t = convexTest(schema, modules);
    // User has only a custom role
    await setupRoleAndUsers(t, ["docs:read"], ["user-1"]);

    // Call recomputeUser directly with an empty map (as syncRoleAction would
    // when the user only holds custom roles). The custom role's permissions
    // must be re-materialized from the customRoles table, not zeroed out.
    await t.mutation(api.unified.recomputeUser, {
      tenantId: TENANT_A,
      userId: "user-1",
      rolePermissionsMap: {}, // no system roles to inject
    });

    const read = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user-1",
      permission: "docs:read",
    });
    expect(read.allowed).toBe(true);
  });
});
