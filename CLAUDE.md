# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- v2.1.1 -->

## Package

`@djpanda/convex-authz` — a Convex component providing RBAC/ABAC/ReBAC authorization with O(1) indexed lookups (inspired by Google Zanzibar). Published as a Convex component via `defineComponent("authz")`.

## Commands

```bash
npm test                 # Run vitest (run mode + type checking)
npm run test:watch       # Vitest in watch mode
npm run build            # Compile via tsconfig.build.json → dist/
npm run build:clean      # Remove dist + tsbuildinfo, full codegen rebuild
npm run build:codegen    # Generate Convex component code + rebuild
npm run lint             # ESLint on all files
npm run typecheck        # tsc --noEmit across src, example, and example/convex
npm run dev              # Parallel: convex dev + vite (example app) + build watcher
```

Run a single test file: `npx vitest run src/component/queries.test.ts`
Run a single test by name: `npx vitest run -t "test name pattern"`
Debug tests: `npm run test:debug` (enables Node inspector, no file parallelism).

## Architecture

### Unified Architecture (v2)

One `Authz` class provides O(1) reads, ABAC policy support, and ReBAC — all in one.

**Dual-layer design:** Source tables store ground truth; effective tables store pre-computed O(1) lookups. All writes go to BOTH layers via `unified.ts` mutations.

- **Source tables**: `roleAssignments`, `userAttributes`, `permissionOverrides`, `relationships`, `customRoles`, `auditLog`
- **Effective tables**: `effectivePermissions`, `effectiveRoles`, `effectiveRelationships`

**Permission check (`can()`) tiered resolution:**
1. O(1) exact lookup in `effectivePermissions` (covers RBAC + overrides)
2. If `policyResult == "deferred"` → evaluate ABAC policy at read time
3. Wildcard pattern fallback for `docs:*` style permissions

**ABAC policy classification:**
- **Static** (`type: "static"`) — evaluated at write time, result stored in `effectivePermissions.policyResult`
- **Deferred** (`type: "deferred"`) — evaluated at read time via `canWithContext()`

**Three authorization models** (RBAC, ABAC, ReBAC) all available on the single `Authz` class. `IndexedAuthz` is a deprecated alias.

### Scope System

Scope (`{ type: string; id: string }`) enables resource-level permissions. A role/permission can be global (no scope) or scoped to a resource (e.g., `{ type: "team", id: "team_123" }`). Indexed tables use `scopeKey` field: `"global"` or `"type:id"`.

### Key File Map

- `src/component/schema.ts` — 9 tables with all indexes
- `src/component/unified.ts` — **v2 core**: tiered checkPermission query + dual-write mutations (assignRoleUnified, revokeRoleUnified, assignCustomRoleUnified, revokeCustomRoleUnified, grantPermissionUnified, denyPermissionUnified, addRelationUnified, removeRelationUnified, setAttributeWithRecompute, recomputeUser). Helpers `tryExtendExistingAssignment`, `writeNewAssignment`, `revokeAssignmentDualWrite` are private and shared by both system-role and custom-role mutation paths. `recomputeUser` resolves `custom:<id>` roles against `customRoles` automatically — callers don't need to pre-build a custom-role map.
- `src/component/customRoles.ts` — **v2.4**: tenant-scoped custom role catalog (createCustomRole, updateCustomRoleDefinition + updateCustomRoleAction for cascade fan-out, deleteCustomRole, listCustomRoles, getCustomRole, getCustomRoleByName, getCustomRolePermissions, countCustomRoles). `customRoleStringFromId(id)` produces the namespaced `"custom:<id>"` string stored in roleAssignments.
- `src/component/mutations.ts` — source-table mutations (offboardUser, deprovisionUser, cleanup, audit)
- `src/component/queries.ts` — read queries (getUserRoles, hasRole, getUserAttributes, getAuditLog). `checkPermission`/`checkPermissions` are now internal.
- `src/component/indexed.ts` — O(1) read queries (checkPermissionFast, hasRoleFast, hasRelationFast, getUserPermissionsFast, getUserRolesFast). Write mutations are now internal.
- `src/component/rebac.ts` — relationship traversal (checkRelationWithTraversal, listAccessibleObjects, listUsersWithAccess)
- `src/component/helpers.ts` — `matchesPermissionPattern`, scope matching, policy context
- `src/client/index.ts` — unified `Authz` class + `definePermissions`, `defineRoles`, `definePolicies`, `defineTraversalRules`, `defineRelationPermissions`, `defineCaveats` helpers. v2.4 adds `CustomRoleId` (branded `Id<"customRoles">`), `CustomRolesConfig<P>`, and 8 new methods on `Authz` (createCustomRole, updateCustomRole, deleteCustomRole, listCustomRoles, getCustomRole, getCustomRoleByName, assignCustomRole, revokeCustomRole). `IndexedAuthz` is a deprecated alias.
- `src/client/validation.ts` — input validation for client methods (incl. validateCustomRoleId, validateCustomRoleName, validateGrantablePermissions, validateCustomRolePermissions)
- `src/react/index.ts` — `AuthzProvider`, `useCanUser`, `useUserRoles`, `PermissionGate`

### Package Exports

- `.` → `dist/client/index.js` (unified Authz class, define* helpers, deprecated IndexedAuthz alias)
- `./react` → `dist/react/index.js` (React hooks/components)
- `./convex.config` → `dist/component/convex.config.js` (component registration)

### Type-Safe Permission/Role Definitions

`definePermissions()` and `defineRoles(permissions, ...)` use generics so that role definitions are type-checked against declared permissions. Roles support `inherits` (single parent) and `includes` (multiple roles) with cycle detection via `flattenRolePermissions()`.

### Wildcard Permissions

Permission strings support patterns: `"*"` (all), `"resource:*"` (all actions on resource), `"*:action"` (action on all resources). Matching happens in `matchesPermissionPattern()`.

### Custom Roles (v2.4, opt-in)

Tenant admins can define their own role bundles at runtime, composed only from a SaaS-provider-supplied `grantablePermissions` whitelist. Storage convention: custom roles are stored in `customRoles` (tenant-scoped) and the role string in `roleAssignments`/`effectiveRoles` is the namespaced form `"custom:<id>"`. Read-path queries (`hasRoleFast`, `checkPermissionFast`) treat them identically to system roles — no branching, no extra reads on the hot path.

**Three load-bearing decisions:**
- **Composition only.** Tenant admins compose existing permissions; they never invent new strings. `grantablePermissions` is enforced at create/update time.
- **Custom-role-from-system snapshot.** Custom role `permissions[]` is a snapshot at create time. Updating a system role definition does not auto-update custom roles built on it (prevents redeploy-breaks-tenant footgun).
- **Custom-role-update cascade.** When a tenant admin edits a custom role, all assigned users are recomputed via `recomputeUser` (`updateCustomRoleAction`, mirrors `syncRoleAction`). No-op edits skip the fan-out.

The feature is fully opt-in: omitting `customRoles` from the `Authz` constructor leaves the existing API surface and behavior untouched.

## Test Pattern

Tests use `convex-test`:

```typescript
import { convexTest } from "convex-test";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const t = convexTest(schema, import.meta.glob("./**/*.ts"));
await t.mutation(api.mutations.assignRole, { userId, role, ... });
const result = await t.query(api.queries.hasRole, { userId, role, ... });
```

Each test gets a fresh database. Test files: `authz.test.ts`, `queries.test.ts`, `indexed.test.ts`, `rebac.test.ts`, `scenarios.test.ts`, `helpers.test.ts`, `unified.test.ts`, `unified-e2e.test.ts`, `tenant-isolation.test.ts`, `customRoles.test.ts`, `customRoleAssignment.test.ts`, `customRoleCascade.test.ts`, `issue-31-custom-roles.test.ts`, `client/index.test.ts`, `client/customRoles.test.ts`, `react/index.test.ts`.

After creating new `.ts` files in `src/component/`, run `npm run build:codegen` to regenerate `_generated/api.ts`.

## Convex Conventions (from .cursor/rules)

- Always use new function syntax: `export const f = query({ args: {}, returns: v.null(), handler: ... })`
- Always include `args` and `returns` validators on all functions
- Use `v.null()` (not undefined) for functions that don't return a value
- Use `withIndex()` for queries — never use `.filter()`
- Index names must include all fields: `by_field1_and_field2`
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions
- Convex queries don't support `.delete()` — collect results and delete individually
- `v.bigint()` is deprecated — use `v.int64()`

## Code Style

- Prettier: trailing commas (`"all"`), prose wrap (`"always"`)
- ESLint: flat config (v9), TypeScript strict, no floating promises, unused vars prefixed with `_`
- Import `.js` extensions for local imports (ESM)

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `example/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
