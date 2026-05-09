import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import schema from "../schema.js";
import { api } from "../_generated/api.js";
import { customRoleStringFromId } from "../customRoles.js";

const modules = import.meta.glob("../**/*.ts");

const TENANT_A = "tenant-acme";
const TENANT_B = "tenant-globex";
const ADMIN_USER = "admin-1";
const GRANTABLE = ["docs:read", "docs:write", "docs:delete", "billing:read"];

describe("customRoles: createCustomRole", () => {
  it("creates a custom role and returns its id", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Senior Editor",
      permissions: ["docs:read", "docs:write"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    expect(typeof id).toBe("string");

    const fetched = await t.query(api.customRoles.getCustomRole, {
      customRoleId: id,
      tenantId: TENANT_A,
    });
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Senior Editor");
    expect(fetched?.permissions).toEqual(["docs:read", "docs:write"]);
    expect(fetched?.createdBy).toBe(ADMIN_USER);
  });

  it("rejects permissions not in grantablePermissions whitelist", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: "Sneaky",
        permissions: ["docs:read", "system:*"], // system:* not in whitelist
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("rejects empty role names", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: "   ",
        permissions: ["docs:read"],
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("rejects duplicate names within the same tenant", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    await expect(
      t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: "Editor",
        permissions: ["docs:write"],
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("allows the same name in a different tenant", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_B,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    expect(typeof id).toBe("string");
  });

  it("enforces maxRolesPerTenant cap", async () => {
    const t = convexTest(schema, modules);

    // Create 3 roles with cap of 3
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: `Role ${i}`,
        permissions: ["docs:read"],
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
        maxRolesPerTenant: 3,
      });
    }

    // 4th should fail
    await expect(
      t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: "Role 3",
        permissions: ["docs:read"],
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
        maxRolesPerTenant: 3,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("writes an audit log entry when enableAudit is true", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Audited Role",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
      enableAudit: true,
    });

    const logsResult = await t.query(api.queries.getAuditLog, {
      tenantId: TENANT_A,
      limit: 10,
    });
    const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
    const created = logs.find((l) => l.action === "custom_role_created");
    expect(created).toBeDefined();
    expect(
      (created?.details as { customRoleName?: string } | undefined)
        ?.customRoleName,
    ).toBe("Audited Role");
  });
});

describe("customRoles: updateCustomRoleDefinition", () => {
  it("updates permissions and reports permissionsChanged=true", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const result = await t.mutation(
      api.customRoles.updateCustomRoleDefinition,
      {
        customRoleId: id,
        tenantId: TENANT_A,
        permissions: ["docs:read", "docs:write"],
        grantablePermissions: GRANTABLE,
      },
    );

    expect(result.permissions).toEqual(["docs:read", "docs:write"]);
    expect(result.permissionsChanged).toBe(true);

    const fetched = await t.query(api.customRoles.getCustomRole, {
      customRoleId: id,
      tenantId: TENANT_A,
    });
    expect(fetched?.permissions).toEqual(["docs:read", "docs:write"]);
  });

  it("reports permissionsChanged=false for set-equal updates", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read", "docs:write"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const result = await t.mutation(
      api.customRoles.updateCustomRoleDefinition,
      {
        customRoleId: id,
        tenantId: TENANT_A,
        permissions: ["docs:write", "docs:read"], // reordered
        grantablePermissions: GRANTABLE,
      },
    );

    expect(result.permissionsChanged).toBe(false);
  });

  it("rejects updates that introduce non-grantable permissions", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    await expect(
      t.mutation(api.customRoles.updateCustomRoleDefinition, {
        customRoleId: id,
        tenantId: TENANT_A,
        permissions: ["docs:read", "system:*"],
        grantablePermissions: GRANTABLE,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("rejects cross-tenant update attempts as not-found", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    await expect(
      t.mutation(api.customRoles.updateCustomRoleDefinition, {
        customRoleId: id,
        tenantId: TENANT_B, // wrong tenant
        permissions: ["docs:write"],
        grantablePermissions: GRANTABLE,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("rejects renaming to an existing name in the tenant", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Taken",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Original",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    await expect(
      t.mutation(api.customRoles.updateCustomRoleDefinition, {
        customRoleId: id,
        tenantId: TENANT_A,
        name: "Taken",
        grantablePermissions: GRANTABLE,
      }),
    ).rejects.toThrow(ConvexError);
  });
});

describe("customRoles: deleteCustomRole", () => {
  it("deletes a role with no assignments", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const result = await t.mutation(api.customRoles.deleteCustomRole, {
      customRoleId: id,
      tenantId: TENANT_A,
    });

    expect(result.deleted).toBe(true);
    expect(result.assignmentsRevoked).toBe(0);

    const fetched = await t.query(api.customRoles.getCustomRole, {
      customRoleId: id,
      tenantId: TENANT_A,
    });
    expect(fetched).toBeNull();
  });

  it("refuses to delete a role with active assignments without force", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT_A,
      userId: "user1",
      role: customRoleStringFromId(id),
      rolePermissions: ["docs:read"],
    });

    await expect(
      t.mutation(api.customRoles.deleteCustomRole, {
        customRoleId: id,
        tenantId: TENANT_A,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("force-deletes a role and cleans up effective rows", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const roleString = customRoleStringFromId(id);

    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT_A,
      userId: "user1",
      role: roleString,
      rolePermissions: ["docs:read"],
    });

    const result = await t.mutation(api.customRoles.deleteCustomRole, {
      customRoleId: id,
      tenantId: TENANT_A,
      force: true,
    });

    expect(result.deleted).toBe(true);
    expect(result.assignmentsRevoked).toBe(1);
    expect(result.effectiveRolesRemoved).toBeGreaterThanOrEqual(1);

    // Permission check should now deny
    const allowed = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: "user1",
      permission: "docs:read",
    });
    expect(allowed.allowed).toBe(false);
  });

  it("rejects cross-tenant delete attempts as not-found", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    await expect(
      t.mutation(api.customRoles.deleteCustomRole, {
        customRoleId: id,
        tenantId: TENANT_B,
      }),
    ).rejects.toThrow(ConvexError);
  });
});

describe("customRoles: queries", () => {
  it("listCustomRoles paginates by tenant", async () => {
    const t = convexTest(schema, modules);

    for (let i = 0; i < 5; i++) {
      await t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: `Role ${i}`,
        permissions: ["docs:read"],
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
      });
    }
    await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_B,
      name: "Other tenant role",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const page = await t.query(api.customRoles.listCustomRoles, {
      tenantId: TENANT_A,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(page.page).toHaveLength(5);
    for (const row of page.page) {
      expect(row.tenantId).toBe(TENANT_A);
    }
  });

  it("getCustomRole returns null for cross-tenant lookups", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const fromB = await t.query(api.customRoles.getCustomRole, {
      customRoleId: id,
      tenantId: TENANT_B,
    });
    expect(fromB).toBeNull();
  });

  it("getCustomRoleByName looks up by tenant + name", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const fetched = await t.query(api.customRoles.getCustomRoleByName, {
      tenantId: TENANT_A,
      name: "Editor",
    });
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Editor");

    const inB = await t.query(api.customRoles.getCustomRoleByName, {
      tenantId: TENANT_B,
      name: "Editor",
    });
    expect(inB).toBeNull();
  });

  it("countCustomRoles returns the count for a tenant", async () => {
    const t = convexTest(schema, modules);

    for (let i = 0; i < 3; i++) {
      await t.mutation(api.customRoles.createCustomRole, {
        tenantId: TENANT_A,
        name: `Role ${i}`,
        permissions: ["docs:read"],
        createdBy: ADMIN_USER,
        grantablePermissions: GRANTABLE,
      });
    }

    expect(
      await t.query(api.customRoles.countCustomRoles, { tenantId: TENANT_A }),
    ).toBe(3);
    expect(
      await t.query(api.customRoles.countCustomRoles, { tenantId: TENANT_B }),
    ).toBe(0);
  });

  it("getCustomRolePermissions returns name + permissions for the assigner", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(api.customRoles.createCustomRole, {
      tenantId: TENANT_A,
      name: "Editor",
      permissions: ["docs:read", "docs:write"],
      createdBy: ADMIN_USER,
      grantablePermissions: GRANTABLE,
    });

    const result = await t.query(api.customRoles.getCustomRolePermissions, {
      customRoleId: id,
      tenantId: TENANT_A,
    });
    expect(result).toEqual({
      name: "Editor",
      permissions: ["docs:read", "docs:write"],
    });

    const crossTenant = await t.query(
      api.customRoles.getCustomRolePermissions,
      {
        customRoleId: id,
        tenantId: TENANT_B,
      },
    );
    expect(crossTenant).toBeNull();
  });
});
