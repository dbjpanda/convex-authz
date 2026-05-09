import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import schema from "../schema.js";
import { api } from "../_generated/api.js";
import { customRoleStringFromId } from "../customRoles.js";

const modules = import.meta.glob("../**/*.ts");

const TENANT_A = "tenant-acme";
const TENANT_B = "tenant-globex";
const ADMIN = "admin-1";
const USER = "user-1";
const GRANTABLE = ["docs:read", "docs:write", "docs:delete", "billing:read"];

async function createRole(
  t: ReturnType<typeof convexTest>,
  opts?: { tenantId?: string; name?: string; permissions?: string[] },
) {
  return await t.mutation(api.customRoles.createCustomRole, {
    tenantId: opts?.tenantId ?? TENANT_A,
    name: opts?.name ?? "Editor",
    permissions: opts?.permissions ?? ["docs:read", "docs:write"],
    createdBy: ADMIN,
    grantablePermissions: GRANTABLE,
  });
}

describe("assignCustomRoleUnified", () => {
  it("assigns a custom role and writes to all three tables", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t);

    const assignmentId = await t.mutation(
      api.unified.assignCustomRoleUnified,
      {
        tenantId: TENANT_A,
        userId: USER,
        customRoleId: roleId,
        assignedBy: ADMIN,
      },
    );
    expect(typeof assignmentId).toBe("string");

    // hasRole should report true under the namespaced role string
    const has = await t.query(api.indexed.hasRoleFast, {
      tenantId: TENANT_A,
      userId: USER,
      role: customRoleStringFromId(roleId),
    });
    expect(has).toBe(true);

    // can() should permit each granted permission
    const canRead = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });
    expect(canRead.allowed).toBe(true);

    const canWrite = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:write",
    });
    expect(canWrite.allowed).toBe(true);

    // and deny what wasn't granted
    const canDelete = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:delete",
    });
    expect(canDelete.allowed).toBe(false);
  });

  it("is idempotent — second assign extends expiry instead of duplicating", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t);

    const id1 = await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
      expiresAt: Date.now() + 60_000,
    });

    const id2 = await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
      expiresAt: Date.now() + 120_000, // longer
    });

    expect(id1).toBe(id2);

    // Only one assignment row should exist
    const roles = await t.query(api.queries.getUserRoles, {
      tenantId: TENANT_A,
      userId: USER,
    });
    expect(roles).toHaveLength(1);
  });

  it("rejects assignment when the customRoleId belongs to a different tenant", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t, { tenantId: TENANT_A });

    await expect(
      t.mutation(api.unified.assignCustomRoleUnified, {
        tenantId: TENANT_B, // wrong tenant
        userId: USER,
        customRoleId: roleId,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("supports scoped assignment", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t);

    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
      scope: { type: "team", id: "team-7" },
    });

    // Permission check inside the scope: allowed
    const inScope = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      scope: { type: "team", id: "team-7" },
    });
    expect(inScope.allowed).toBe(true);

    // Permission check outside the scope: denied
    const outOfScope = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      scope: { type: "team", id: "team-other" },
    });
    expect(outOfScope.allowed).toBe(false);

    // Global permission check: denied (no global grant)
    const global = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });
    expect(global.allowed).toBe(false);
  });

  it("writes audit log with customRoleId/customRoleName when enabled", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t, { name: "Reviewer" });

    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
      assignedBy: ADMIN,
      enableAudit: true,
    });

    const logsResult = await t.query(api.queries.getAuditLog, {
      tenantId: TENANT_A,
    });
    const logs = Array.isArray(logsResult) ? logsResult : logsResult.page;
    const assigned = logs.find((l) => l.action === "role_assigned");
    expect(assigned).toBeDefined();
    const details = assigned?.details as {
      customRoleId?: string;
      customRoleName?: string;
    };
    expect(details.customRoleId).toBe(roleId);
    expect(details.customRoleName).toBe("Reviewer");
  });

  it("custom + system roles compose: union of permissions", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t, { permissions: ["docs:read"] });

    // System role assignment grants docs:write
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      role: "writer",
      rolePermissions: ["docs:write"],
    });
    // Custom role assignment grants docs:read
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });

    const r = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });
    expect(r.allowed).toBe(true);

    const w = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:write",
    });
    expect(w.allowed).toBe(true);
  });
});

describe("revokeCustomRoleUnified", () => {
  it("revokes a custom role and removes effective rows", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t);

    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });

    const revoked = await t.mutation(api.unified.revokeCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });
    expect(revoked).toBe(true);

    const has = await t.query(api.indexed.hasRoleFast, {
      tenantId: TENANT_A,
      userId: USER,
      role: customRoleStringFromId(roleId),
    });
    expect(has).toBe(false);

    const canRead = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });
    expect(canRead.allowed).toBe(false);
  });

  it("is idempotent — revoking when no assignment exists returns false", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t);

    const result = await t.mutation(api.unified.revokeCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });
    expect(result).toBe(false);
  });

  it("rejects cross-tenant revoke as not-found", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t, { tenantId: TENANT_A });

    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });

    await expect(
      t.mutation(api.unified.revokeCustomRoleUnified, {
        tenantId: TENANT_B,
        userId: USER,
        customRoleId: roleId,
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("revoking custom role does not strip permissions held via another source", async () => {
    const t = convexTest(schema, modules);
    const roleId = await createRole(t, { permissions: ["docs:read"] });

    // Direct grant of docs:read
    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
      createdBy: ADMIN,
    });
    // Custom role also grants docs:read
    await t.mutation(api.unified.assignCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });

    // Revoke the custom role
    await t.mutation(api.unified.revokeCustomRoleUnified, {
      tenantId: TENANT_A,
      userId: USER,
      customRoleId: roleId,
    });

    // docs:read still allowed because of the direct grant
    const canRead = await t.query(api.unified.checkPermission, {
      tenantId: TENANT_A,
      userId: USER,
      permission: "docs:read",
    });
    expect(canRead.allowed).toBe(true);
  });
});
