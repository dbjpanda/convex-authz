/**
 * Type-level tests for PermissionArg<P>.
 *
 * These tests verify that TypeScript catches invalid permission strings
 * at compile time using @ts-expect-error annotations. They do NOT
 * execute any Authz methods — they only verify compilation.
 *
 * Run: npx vitest run src/client/type-safety.test.ts --typecheck
 */
import { describe, test, expect } from "vitest";
import {
  type Authz,
  definePermissions,
  type PermissionString,
  type PermissionArg,
} from "./index.js";

const permissions = definePermissions({
  documents: { create: true, read: true, update: true, delete: true },
  settings: { view: true, manage: true },
  billing: { view: true, manage: true },
});

type P = typeof permissions;

describe("Type-safe permission strings", () => {
  test("PermissionString<P> derives correct union type", () => {
    const p1: PermissionString<P> = "documents:read";
    const p2: PermissionString<P> = "documents:create";
    const p3: PermissionString<P> = "documents:update";
    const p4: PermissionString<P> = "documents:delete";
    const p5: PermissionString<P> = "settings:view";
    const p6: PermissionString<P> = "settings:manage";
    const p7: PermissionString<P> = "billing:view";
    const p8: PermissionString<P> = "billing:manage";

    expect(p1).toBe("documents:read");
    expect(p2).toBe("documents:create");
    expect(p3).toBe("documents:update");
    expect(p4).toBe("documents:delete");
    expect(p5).toBe("settings:view");
    expect(p6).toBe("settings:manage");
    expect(p7).toBe("billing:view");
    expect(p8).toBe("billing:manage");
  });

  test("PermissionArg<P> accepts wildcard patterns", () => {
    const w1: PermissionArg<P> = "documents:*";
    const w2: PermissionArg<P> = "settings:*";
    const w3: PermissionArg<P> = "*:read";
    const w4: PermissionArg<P> = "*:manage";
    const w5: PermissionArg<P> = "*";
    const w6: PermissionArg<P> = "*:*";

    expect(w1).toBe("documents:*");
    expect(w2).toBe("settings:*");
    expect(w3).toBe("*:read");
    expect(w4).toBe("*:manage");
    expect(w5).toBe("*");
    expect(w6).toBe("*:*");
  });

  test("invalid permission strings produce TypeScript errors", () => {
    // Each @ts-expect-error MUST produce a TS error — vitest --typecheck verifies this.

    // @ts-expect-error — typo in resource name
    const _bad1: PermissionArg<P> = "documets:read";

    // @ts-expect-error — typo in action name
    const _bad2: PermissionArg<P> = "documents:reed";

    // @ts-expect-error — non-existent resource
    const _bad3: PermissionArg<P> = "users:create";

    // @ts-expect-error — non-existent action
    const _bad4: PermissionArg<P> = "documents:archive";

    // @ts-expect-error — not a valid format
    const _bad5: PermissionArg<P> = "justAString";

    // @ts-expect-error — wildcard with non-existent action
    const _bad6: PermissionArg<P> = "*:archive";

    // @ts-expect-error — wildcard with non-existent resource
    const _bad7: PermissionArg<P> = "users:*";

    expect(true).toBe(true);
  });

  test("Authz method signatures accept PermissionArg<P> (type-level only)", () => {
    // This test verifies at the TYPE level that Authz methods accept PermissionArg<P>.
    // We use a type assertion to check the function signature without calling it.

    type TestAuthz = Authz<P, Record<string, never>>;

    // can() should accept valid permissions
    type CanPermArg = Parameters<TestAuthz["can"]>[2];
    const _validCan: CanPermArg = "documents:read";
    const _validCanWild: CanPermArg = "documents:*";

    // @ts-expect-error — typo should fail
    const _badCan: CanPermArg = "documets:read";

    // require() should accept valid permissions
    type RequirePermArg = Parameters<TestAuthz["require"]>[2];
    const _validRequire: RequirePermArg = "settings:manage";

    // @ts-expect-error — invalid action
    const _badRequire: RequirePermArg = "settings:delete";

    // grantPermission() should accept valid permissions
    type GrantPermArg = Parameters<TestAuthz["grantPermission"]>[2];
    const _validGrant: GrantPermArg = "billing:view";
    const _validGrantWild: GrantPermArg = "*";

    // @ts-expect-error — invalid resource
    const _badGrant: GrantPermArg = "nonexistent:perm";

    // canAny() should accept valid permission arrays
    type CanAnyPermArg = Parameters<TestAuthz["canAny"]>[2];
    const _validCanAny: CanAnyPermArg = ["documents:read", "settings:view"];

    expect(true).toBe(true);
  });
});

// ============================================================================
// Type-safety invariants for tenant-defined custom roles (issue #31)
// ============================================================================

describe("Custom roles: branded CustomRoleId cannot be confused with strings", () => {
  test("CustomRoleId is structurally distinct from raw string", () => {
    // Compile-time only — verifies that a raw string cannot be passed where
    // CustomRoleId is expected without an explicit cast. Runtime branded
    // types in TypeScript guard against accidental coercion.
    type AssignArg = Parameters<
      Authz<P, never, never>["assignCustomRole"]
    >[2];

    // Valid: explicit cast through the branded type (this is what
    // createCustomRole returns).
    const _valid: AssignArg = "k1234567890" as unknown as AssignArg;

    // @ts-expect-error — raw string cannot satisfy the branded CustomRoleId
    const _bad: AssignArg = "raw_string";
    void _bad;

    expect(true).toBe(true);
  });

  test("CustomRoleId from one tenant cannot be confused with system role names", () => {
    // System role names are typed as `keyof R & string`. Custom role ids are
    // typed as `Id<"customRoles">`. They are structurally disjoint at the
    // type level, so the wrong one in the wrong slot is caught.
    type TestAuthz = Authz<
      P,
      { admin: { documents: ["read"] }; viewer: { documents: ["read"] } }
    >;

    // assignRole takes a system role name (keyof R & string)
    type AssignRoleArg = Parameters<TestAuthz["assignRole"]>[2];
    const _validRole: AssignRoleArg = "admin";
    // @ts-expect-error — random string isn't in the role definition
    const _badRole: AssignRoleArg = "k1234";
    void _badRole;

    expect(true).toBe(true);
  });
});

describe("Custom roles: grantablePermissions whitelist is type-checked", () => {
  test("non-existent permission strings are rejected in grantablePermissions", () => {
    // The customRoles config's grantablePermissions is typed as
    // ReadonlyArray<PermissionArg<P>>, so typos in the whitelist itself
    // are caught at compile time — the SaaS provider can't accidentally
    // widen the security boundary by typo.
    type Options = ConstructorParameters<typeof Authz<P, never, never>>[1];
    type CustomRolesConfig = NonNullable<Options["customRoles"]>;
    type Whitelist = CustomRolesConfig["grantablePermissions"];

    // Valid: real permissions
    const _ok: Whitelist = ["documents:read", "settings:view"];

    // @ts-expect-error — typo: "documets" instead of "documents"
    const _bad: Whitelist = ["documets:read"];
    void _bad;

    // @ts-expect-error — non-existent action
    const _bad2: Whitelist = ["documents:fly"];
    void _bad2;

    expect(true).toBe(true);
  });

  test("createCustomRole permissions arg is constrained to PermissionArg<P>", () => {
    type CreateArg = Parameters<
      Authz<P, never, never>["createCustomRole"]
    >[1];
    type PermsField = CreateArg["permissions"];

    // Valid: typed permission strings
    const _ok: PermsField = ["documents:read"] as const;

    // @ts-expect-error — typo
    const _bad: PermsField = ["documets:read"] as const;
    void _bad;

    expect(true).toBe(true);
  });
});

describe("Custom roles: existing permission/role typing is preserved", () => {
  test("assignRole still rejects unknown system role names (issue #23 invariant)", () => {
    // Critical regression check: adding the customRoles feature must not
    // weaken the static type-safety win from issue #23 — `keyof R & string`
    // is still the type of the `role` parameter for system-role assignment.
    type TestAuthz = Authz<
      P,
      { admin: { documents: ["read"] }; viewer: { documents: ["read"] } }
    >;
    type AssignArg = Parameters<TestAuthz["assignRole"]>[2];
    const _ok: AssignArg = "admin";
    // @ts-expect-error — typo in role name
    const _bad: AssignArg = "admni";
    void _bad;

    expect(true).toBe(true);
  });

  test("can() still rejects typo'd permissions (issue #23 invariant)", () => {
    type TestAuthz = Authz<P, never, never>;
    type CanArg = Parameters<TestAuthz["can"]>[2];
    const _ok: CanArg = "documents:read";
    // @ts-expect-error — typo
    const _bad: CanArg = "documets:read";
    void _bad;

    expect(true).toBe(true);
  });
});
