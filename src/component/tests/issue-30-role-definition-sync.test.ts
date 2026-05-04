/**
 * Regression tests for issue #30: role-definition changes propagate to
 * existing assignments via `syncRoleAction` / `syncRoles`.
 *
 * https://github.com/dbjpanda/convex-authz/issues/30
 *
 * The bug: `effectivePermissions` is materialized at role-assignment time
 * using the role's permission list at that moment. Changing the role
 * definition in client code does not retroactively update existing rows.
 *
 * The fix: `syncRoleAction` walks every assignment of a role within a
 * tenant and calls `recomputeUser` per user, rebuilding the effective rows
 * from the supplied (new) permission map. Direct grants and denies survive.
 */

import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import schema from "../schema.js";
import { api } from "../_generated/api.js";

const modules = import.meta.glob("../**/*.ts");
const TENANT = "tenant-issue-30";

describe("issue #30 — role-definition sync via syncRoleAction", () => {
  test("syncRoleAction picks up role-definition changes for existing assignments", async () => {
    const t = convexTest(schema, modules);

    // Assign the `member` role with the OLD permission list.
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT,
      userId: "alice",
      role: "member",
      rolePermissions: ["organizations:read"],
    });

    // Sanity: the new permission isn't visible yet.
    const before = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "alice",
      permission: "members:list",
    });
    expect(before.allowed).toBe(false);

    // Sync the role with the NEW permission list (as if the role definition
    // in client code gained `members:list` and the app redeployed).
    const result = await t.action(api.unified.syncRoleAction, {
      tenantId: TENANT,
      role: "member",
      rolePermissionsMap: {
        member: ["organizations:read", "members:list"],
      },
    });
    expect(result.usersProcessed).toBe(1);

    // The new permission now resolves for the existing assignment.
    const after = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "alice",
      permission: "members:list",
    });
    expect(after.allowed).toBe(true);

    // The old permission still works.
    const stillThere = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "alice",
      permission: "organizations:read",
    });
    expect(stillThere.allowed).toBe(true);
  });

  test("syncRoleAction preserves direct grants and direct denies", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT,
      userId: "carol",
      role: "member",
      rolePermissions: ["organizations:read"],
    });

    // Direct grant outside the role.
    await t.mutation(api.unified.grantPermissionUnified, {
      tenantId: TENANT,
      userId: "carol",
      permission: "billing:export",
      reason: "one-off audit",
    });

    // Direct deny that overrides a role-granted permission.
    await t.mutation(api.unified.denyPermissionUnified, {
      tenantId: TENANT,
      userId: "carol",
      permission: "organizations:read",
      reason: "compliance hold",
    });

    await t.action(api.unified.syncRoleAction, {
      tenantId: TENANT,
      role: "member",
      rolePermissionsMap: {
        member: ["organizations:read", "members:list"],
      },
    });

    // Direct grant survives.
    const grant = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "carol",
      permission: "billing:export",
    });
    expect(grant.allowed).toBe(true);

    // Direct deny survives — still blocks the role-granted permission.
    const deny = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "carol",
      permission: "organizations:read",
    });
    expect(deny.allowed).toBe(false);

    // The new role permission is now reachable.
    const newPerm = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "carol",
      permission: "members:list",
    });
    expect(newPerm.allowed).toBe(true);
  });

  test("syncRoleAction respects tenant isolation", async () => {
    const t = convexTest(schema, modules);

    // Same role name, two tenants. Sync runs against tenant-a only.
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: "tenant-a",
      userId: "alice",
      role: "member",
      rolePermissions: ["organizations:read"],
    });
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: "tenant-b",
      userId: "bob",
      role: "member",
      rolePermissions: ["organizations:read"],
    });

    const result = await t.action(api.unified.syncRoleAction, {
      tenantId: "tenant-a",
      role: "member",
      rolePermissionsMap: {
        member: ["organizations:read", "members:list"],
      },
    });
    // Only one user in tenant-a — bob in tenant-b must not be touched.
    expect(result.usersProcessed).toBe(1);

    const aliceCanList = await t.query(api.unified.checkPermission, {
      tenantId: "tenant-a",
      userId: "alice",
      permission: "members:list",
    });
    expect(aliceCanList.allowed).toBe(true);

    const bobCanList = await t.query(api.unified.checkPermission, {
      tenantId: "tenant-b",
      userId: "bob",
      permission: "members:list",
    });
    expect(bobCanList.allowed).toBe(false);
  });

  test("syncRoleAction dedupes users with the same role in multiple scopes", async () => {
    const t = convexTest(schema, modules);

    // alice has `member` role globally AND scoped to a team.
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT,
      userId: "alice",
      role: "member",
      rolePermissions: ["organizations:read"],
    });
    await t.mutation(api.unified.assignRoleUnified, {
      tenantId: TENANT,
      userId: "alice",
      role: "member",
      rolePermissions: ["organizations:read"],
      scope: { type: "team", id: "team-1" },
    });

    const result = await t.action(api.unified.syncRoleAction, {
      tenantId: TENANT,
      role: "member",
      rolePermissionsMap: {
        member: ["organizations:read", "members:list"],
      },
    });

    // Two assignments, but only one unique user → one recompute.
    expect(result.usersProcessed).toBe(1);
  });

  test("syncRoleAction paginates across many users", async () => {
    const t = convexTest(schema, modules);

    // Page size in syncRoleAction is 50; create 60 users to force a second page.
    const userCount = 60;
    for (let i = 0; i < userCount; i++) {
      await t.mutation(api.unified.assignRoleUnified, {
        tenantId: TENANT,
        userId: `user_${i}`,
        role: "member",
        rolePermissions: ["organizations:read"],
      });
    }

    const result = await t.action(api.unified.syncRoleAction, {
      tenantId: TENANT,
      role: "member",
      rolePermissionsMap: {
        member: ["organizations:read", "members:list"],
      },
    });
    expect(result.usersProcessed).toBe(userCount);

    // Spot-check a user from the first batch and one from the second.
    const first = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: "user_0",
      permission: "members:list",
    });
    expect(first.allowed).toBe(true);

    const last = await t.query(api.unified.checkPermission, {
      tenantId: TENANT,
      userId: `user_${userCount - 1}`,
      permission: "members:list",
    });
    expect(last.allowed).toBe(true);
  });

  test("syncRoleAction is a no-op when no users hold the role", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.unified.syncRoleAction, {
      tenantId: TENANT,
      role: "member",
      rolePermissionsMap: { member: ["organizations:read"] },
    });
    expect(result.usersProcessed).toBe(0);
  });
});
