import { describe, expect, it, vi } from "vitest";
import {
  Authz,
  definePermissions,
  defineRoles,
  type CustomRoleId,
} from "./index.js";
import type { ComponentApi } from "../component/_generated/component.js";

const permissions = definePermissions({
  docs: { read: true, write: true, delete: true, archive: true },
  billing: { read: true, manage: true },
});
const roles = defineRoles(permissions, {
  admin: { docs: ["read", "write", "delete"], billing: ["read", "manage"] },
  viewer: { docs: ["read"] },
});

const GRANTABLE = ["docs:read", "docs:write", "docs:archive"] as const;

function createMockComponent() {
  return {
    queries: {},
    mutations: {},
    unified: {
      assignRoleUnified: "unified.assignRoleUnified",
      revokeRoleUnified: "unified.revokeRoleUnified",
      assignCustomRoleUnified: "unified.assignCustomRoleUnified",
      revokeCustomRoleUnified: "unified.revokeCustomRoleUnified",
    },
    customRoles: {
      createCustomRole: "customRoles.createCustomRole",
      updateCustomRoleAction: "customRoles.updateCustomRoleAction",
      deleteCustomRole: "customRoles.deleteCustomRole",
      listCustomRoles: "customRoles.listCustomRoles",
      getCustomRole: "customRoles.getCustomRole",
      getCustomRoleByName: "customRoles.getCustomRoleByName",
    },
  } as unknown as ComponentApi;
}

function makeAuthzWithCustomRoles() {
  return new Authz(createMockComponent(), {
    permissions,
    roles,
    tenantId: "test-tenant",
    customRoles: {
      enabled: true,
      grantablePermissions: GRANTABLE,
      maxRolesPerTenant: 50,
    },
  });
}

describe("Authz constructor: customRoles config", () => {
  it("accepts a config with non-empty grantablePermissions", () => {
    expect(() => makeAuthzWithCustomRoles()).not.toThrow();
  });

  it("rejects an enabled config with an empty whitelist", () => {
    expect(
      () =>
        new Authz(createMockComponent(), {
          permissions,
          roles,
          tenantId: "test-tenant",
          customRoles: {
            enabled: true,
            grantablePermissions: [],
          },
        }),
    ).toThrow(/grantablePermissions/i);
  });

  it("works without the customRoles option (feature disabled)", () => {
    const authz = new Authz(createMockComponent(), {
      permissions,
      roles,
      tenantId: "test-tenant",
    });
    // Methods should throw with a helpful message when called without the feature
    expect(() =>
      authz.createCustomRole({} as never, {
        name: "x",
        permissions: ["docs:read"],
        createdBy: "admin",
      }),
    ).rejects.toThrow(/customRoles feature is not enabled/);
  });
});

describe("Authz.createCustomRole", () => {
  it("forwards args to the mutation with the configured whitelist", async () => {
    const authz = makeAuthzWithCustomRoles();
    const mockId = "k1234567890" as CustomRoleId;
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(mockId),
    };

    const id = await authz.createCustomRole(ctx, {
      name: "Senior Editor",
      permissions: ["docs:read", "docs:write"],
      description: "Can edit but not delete",
      createdBy: "admin-1",
    });

    expect(id).toBe(mockId);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      "customRoles.createCustomRole",
      expect.objectContaining({
        tenantId: "test-tenant",
        name: "Senior Editor",
        permissions: ["docs:read", "docs:write"],
        description: "Can edit but not delete",
        createdBy: "admin-1",
        grantablePermissions: GRANTABLE,
        maxRolesPerTenant: 50,
        enableAudit: true,
      }),
    );
  });

  it("rejects permissions not in the whitelist client-side", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = { runMutation: vi.fn() };

    await expect(
      authz.createCustomRole(ctx, {
        name: "Bad",
        permissions: ["docs:delete"], // not in whitelist
        createdBy: "admin",
      }),
    ).rejects.toThrow(/grantablePermissions/);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("rejects empty role names", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = { runMutation: vi.fn() };

    await expect(
      authz.createCustomRole(ctx, {
        name: "   ",
        permissions: ["docs:read"],
        createdBy: "admin",
      }),
    ).rejects.toThrow();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});

describe("Authz.updateCustomRole", () => {
  it("invokes the cascade action and returns its result", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn().mockResolvedValue({
        permissionsChanged: true,
        usersRecomputed: 7,
      }),
    };

    const result = await authz.updateCustomRole(ctx, {
      customRoleId: "k1234" as CustomRoleId,
      permissions: ["docs:read", "docs:write"],
      actorId: "admin",
    });

    expect(result.permissionsChanged).toBe(true);
    expect(result.usersRecomputed).toBe(7);
    expect(ctx.runAction).toHaveBeenCalledWith(
      "customRoles.updateCustomRoleAction",
      expect.objectContaining({
        customRoleId: "k1234",
        tenantId: "test-tenant",
        permissions: ["docs:read", "docs:write"],
        grantablePermissions: GRANTABLE,
      }),
    );
  });

  it("rejects updates that introduce non-grantable permissions", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await expect(
      authz.updateCustomRole(ctx, {
        customRoleId: "k1234" as CustomRoleId,
        permissions: ["billing:manage"], // not in whitelist
      }),
    ).rejects.toThrow(/grantablePermissions/);
    expect(ctx.runAction).not.toHaveBeenCalled();
  });
});

describe("Authz.assignCustomRole / revokeCustomRole", () => {
  it("assignCustomRole forwards to assignCustomRoleUnified", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runMutation: vi.fn().mockResolvedValue("assignment_id_1"),
    };
    const result = await authz.assignCustomRole(
      ctx,
      "user-1",
      "k1234" as CustomRoleId,
      { type: "team", id: "team-7" },
    );
    expect(result).toBe("assignment_id_1");
    expect(ctx.runMutation).toHaveBeenCalledWith(
      "unified.assignCustomRoleUnified",
      expect.objectContaining({
        tenantId: "test-tenant",
        userId: "user-1",
        customRoleId: "k1234",
        scope: { type: "team", id: "team-7" },
        enableAudit: true,
      }),
    );
  });

  it("revokeCustomRole forwards to revokeCustomRoleUnified", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(true),
    };
    const result = await authz.revokeCustomRole(
      ctx,
      "user-1",
      "k1234" as CustomRoleId,
    );
    expect(result).toBe(true);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      "unified.revokeCustomRoleUnified",
      expect.objectContaining({
        tenantId: "test-tenant",
        userId: "user-1",
        customRoleId: "k1234",
      }),
    );
  });
});

describe("Authz.deleteCustomRole / listCustomRoles / getCustomRole", () => {
  it("deleteCustomRole forwards force flag", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runMutation: vi.fn().mockResolvedValue({
        deleted: true,
        assignmentsRevoked: 3,
        effectiveRolesRemoved: 3,
        effectivePermissionsRemoved: 9,
      }),
    };
    await authz.deleteCustomRole(ctx, {
      customRoleId: "k1234" as CustomRoleId,
      force: true,
    });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      "customRoles.deleteCustomRole",
      expect.objectContaining({ force: true }),
    );
  });

  it("listCustomRoles forwards pagination opts", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runQuery: vi.fn().mockResolvedValue({
        page: [],
        isDone: true,
        continueCursor: "",
      }),
    };
    await authz.listCustomRoles(ctx, { numItems: 50, cursor: null });
    expect(ctx.runQuery).toHaveBeenCalledWith(
      "customRoles.listCustomRoles",
      expect.objectContaining({
        tenantId: "test-tenant",
        paginationOpts: { numItems: 50, cursor: null },
      }),
    );
  });

  it("getCustomRole returns null when not found", async () => {
    const authz = makeAuthzWithCustomRoles();
    const ctx = {
      runQuery: vi.fn().mockResolvedValue(null),
    };
    const result = await authz.getCustomRole(ctx, "k1234" as CustomRoleId);
    expect(result).toBeNull();
  });
});
