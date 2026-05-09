---
name: convex-authz
description: Add production-ready authorization (RBAC, ABAC, ReBAC) to Convex apps with O(1) permission checks. Use when implementing roles, permissions, access control, multi-tenancy, or relationship-based authorization in a Convex project. Inspired by Google Zanzibar / SpiceDB.
license: Apache-2.0
compatibility:
  agents:
    - claude-code
    - cursor
    - github-copilot
    - cline
    - windsurf
  languages:
    - typescript
  frameworks:
    - convex
    - react
    - next.js
metadata:
  tags: convex, authorization, rbac, abac, rebac, permissions, roles, zanzibar, multi-tenant, access-control
  author: djpanda
  npm: "@djpanda/convex-authz"
  repository: https://github.com/dbjpanda/convex-authz
---

# @djpanda/convex-authz

A comprehensive, production-ready authorization component for [Convex](https://convex.dev) featuring **RBAC**, **ABAC**, and **ReBAC** with **O(1) indexed lookups**, inspired by [Google Zanzibar](https://research.google/pubs/pub48190/).

[![npm version](https://badge.fury.io/js/@djpanda%2Fconvex-authz.svg)](https://www.npmjs.com/package/@djpanda/convex-authz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Convex Approved](https://www.convex.dev/components/badge/djpanda/convex-tenants)](https://www.convex.dev/components/djpanda/convex-tenants)

## Features


| Feature                | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| **RBAC**               | Role-Based Access Control with scoped roles            |
| **ABAC**               | Attribute-Based Access Control with custom policies    |
| **ReBAC**              | Relationship-Based Access Control with graph traversal |
| **O(1) Lookups**       | Pre-computed permissions for instant checks            |
| **Type Safety**        | Full TypeScript support with type-safe permissions     |
| **Audit Logging**      | Track all permission changes and checks                |
| **Scoped Permissions** | Resource-level access control                          |
| **Expiring Grants**    | Time-limited role assignments and permissions          |
| **Convex Native**      | Built specifically for Convex, with real-time updates  |


## Terminology


| Term                    | Definition                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **RBAC**                | Role-Based Access Control - permissions assigned via roles (admin, editor, viewer)                             |
| **ABAC**                | Attribute-Based Access Control - permissions based on user/resource attributes (department=engineering)        |
| **ReBAC**               | Relationship-Based Access Control - permissions derived from relationships (member of team that owns resource) |
| **Zanzibar**            | Google's global authorization system, inspiration for OpenFGA and this component                               |
| **Tuple**               | A relationship triple: `(subject, relation, object)` e.g., `(user:alice, member, team:sales)`                  |
| **Scope**               | Resource-level permission context, e.g., "admin of team:123" vs global "admin"                                 |
| **Traversal**           | Following relationship chains to determine inherited access                                                    |
| **O(1) Lookup**         | Constant-time permission check via pre-computed indexes                                                        |
| **Permission Override** | Direct grant/deny that bypasses role-based permissions                                                         |


---

## Installation

```bash
npm install @djpanda/convex-authz
```

---

## Quick Start

### 1. Register the Component

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import authz from "@djpanda/convex-authz/convex.config";

const app = defineApp();
app.use(authz);

export default app;
```

### 2. Define Your Permissions and Roles

```typescript
// convex/authz.ts
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { components } from "./_generated/api";

// Step 1: Define permissions
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

// Step 2: Define roles
const roles = defineRoles(permissions, {
  admin: {
    documents: ["create", "read", "update", "delete"],
    settings: ["view", "manage"],
  },
  editor: {
    documents: ["create", "read", "update"],
    settings: ["view"],
  },
  viewer: {
    documents: ["read"],
  },
});

// Step 3: Create the authz client
export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
```

#### Role inheritance and composition

Roles can be defined in terms of other roles to avoid repeating permission lists:

- `**inherits**` – one parent role; effective permissions = parent’s permissions ∪ this role’s direct permissions.
- `**includes**` – multiple roles; effective permissions = union of all included roles’ permissions ∪ this role’s direct permissions.

Example with inheritance (admin > editor > viewer):

```typescript
const roles = defineRoles(permissions, {
  viewer: { documents: ["read"] },
  editor: { inherits: "viewer", documents: ["create", "update"] },
  admin: { inherits: "editor", documents: ["delete"], settings: ["manage"] },
});
```

Example with composition (combine roles):

```typescript
const roles = defineRoles(permissions, {
  editor: { documents: ["create", "read", "update"] },
  billing_admin: { billing: ["view", "manage"] },
  billing_manager: { includes: ["editor", "billing_admin"], settings: ["view"] },
});
```

**Note:** `inherits` and `includes` are reserved keys in role definitions; do not use them as permission resource names.

### 3. Use in Your Functions

```typescript
// convex/documents.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authz } from "./authz";
import { getAuthUserId } from "@convex-dev/auth/server";

export const updateDocument = mutation({
  args: { docId: v.id("documents"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Check permission (throws if denied)
    await authz.require(ctx, userId, "documents:update");
    
    // Or with scope
    await authz.require(ctx, userId, "documents:update", {
      type: "document",
      id: args.docId,
    });
    
    // Proceed with update...
  },
});
```

---

## Unified Authz v2

v2 consolidates everything into a single `Authz` class. If you previously used `IndexedAuthz`, just rename it — the constructor signature is identical.

### What changed

- **One class**: `Authz` replaces both the original `Authz` and `IndexedAuthz`. O(1) reads via pre-computed effective tables are now the default.
- **ReBAC on `Authz`**: `hasRelation`, `addRelation`, and `removeRelation` are available directly on every `Authz` instance.
- **ABAC policy types**: Policies accept a `type` field (`"static"` or `"deferred"`). In the current implementation, both types are evaluated at read-time when `can()` is called — Convex mutations cannot call queries, so write-time evaluation is not possible. The `type` field is reserved for future optimization but currently has no behavioral difference.
- `**canWithContext()`**: Check deferred ABAC policies that need runtime context (e.g. IP address, time of day).
- `**recomputeUser()**`: Rebuild a user's effective-permissions table on demand — useful after a schema change or post-deploy migration.
- `**withTenant()**`: Get a scoped copy of the client bound to a different tenant for cross-tenant admin operations.

### ReBAC example

```typescript
// Add a relationship
await authz.addRelation(ctx, { type: "user", id: userId }, "member", { type: "team", id: teamId });

// Check a relationship
const isMember = await authz.hasRelation(ctx, { type: "user", id: userId }, "member", { type: "team", id: teamId });

// Remove a relationship
await authz.removeRelation(ctx, { type: "user", id: userId }, "member", { type: "team", id: teamId });
```

### ReBAC → Permission Bridge

Use `defineRelationPermissions` to automatically grant permissions when relationships are created:

```typescript
import { defineRelationPermissions } from "@djpanda/convex-authz";

const authz = new Authz(components.authz, {
  permissions, roles, tenantId: "my-app",
  relationPermissions: defineRelationPermissions({
    "document:viewer": ["documents:read"],
    "document:editor": ["documents:read", "documents:update"],
    "document:owner": ["documents:read", "documents:update", "documents:delete"],
  }),
});

// Adding a relation automatically grants scoped permissions
await authz.addRelation(ctx, { type: "user", id: userId }, "editor", { type: "document", id: docId });

// can() now checks relation-derived permissions — no separate hasRelation() needed
const canUpdate = await authz.can(ctx, userId, "documents:update", { type: "document", id: docId }); // true

// Removing the relation revokes the permissions
await authz.removeRelation(ctx, { type: "user", id: userId }, "editor", { type: "document", id: docId });
```

### ABAC example

```typescript
// Policies are always evaluated at read-time when can() is called.
// The optional type field ("static" | "deferred") is reserved for future use
// and currently has no behavioral effect.
const policies = definePolicies({
  "documents:read": {
    condition: (ctx) => ctx.getAttribute("verified") === true,
    message: "Only verified users can read documents",
  },
  "billing:export": {
    condition: (ctx) => {
      const hour = new Date().getUTCHours();
      return hour >= 9 && hour <= 17;
    },
    message: "Billing exports only during business hours",
  },
});

// Use canWithContext() when request context is available
const allowed = await authz.canWithContext(ctx, userId, "documents:read", undefined, {
  ipAllowlisted: true,
});
```

### Post-deploy rebuild

```typescript
// Rebuild a single user's effective permissions after upgrading
await authz.recomputeUser(ctx, userId);
```

### Cross-tenant operations

```typescript
const otherTenantAuthz = authz.withTenant("other-tenant-id");
const allowed = await otherTenantAuthz.can(ctx, userId, "documents:read");
```

### Migration guide: `IndexedAuthz` → `Authz`

> **Note:** `IndexedAuthz` is no longer exported in v2. The import below will fail — just replace it with `Authz`.

```typescript
// Before (v1) — this import no longer works in v2
// import { IndexedAuthz } from "@djpanda/convex-authz";
// const authz = new IndexedAuthz(components.authz, { permissions, roles, tenantId: "my-app" });

// After (v2) — same constructor, just rename the class
import { Authz } from "@djpanda/convex-authz";
const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
```

After upgrading, run `recomputeUser()` for each existing user to backfill the effective-permissions table:

```typescript
// one-time migration mutation
export const backfillEffectivePermissions = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await authz.recomputeUser(ctx, String(user._id));
    }
  },
});
```

---

## React integration

The package provides React hooks and a `PermissionGate` component so your UI can check permissions and roles reactively. Your app must expose Convex queries that wrap the Authz component (e.g. `checkPermission`, `getUserRoles`). The hooks call those queries via Convex’s `useQuery`, so permission and role changes stay up to date without polling.

### 1. Expose Convex queries

Define queries that delegate to your authz client, for example:

```typescript
// convex/app.ts (or similar)
import { query } from "./_generated/server";
import { v } from "convex/values";
import { authz } from "./authz";

export const checkPermission = query({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  handler: async (ctx, args) => {
    return authz.can(ctx, args.userId, args.permission, args.scope);
  },
});

export const getUserRoles = query({
  args: {
    userId: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  handler: async (ctx, args) => {
    return authz.getUserRoles(ctx, args.userId, args.scope);
  },
});
```

### 2. Wrap your app with AuthzProvider

Pass your Convex query refs (and optionally a default user id) to the provider:

```tsx
import { AuthzProvider } from "@djpanda/convex-authz/react";
import { api } from "./convex/_generated/api";

<AuthzProvider
  queryRefs={{
    checkPermission: api.app.checkPermission,
    getUserRoles: api.app.getUserRoles,
  }}
  defaultUserId={currentUserId}  // optional; hooks can pass userId in options
>
  <App />
</AuthzProvider>
```

### 3. Use hooks and PermissionGate

- **useCanUser(permission, options?)** — Returns `{ allowed, isLoading, error }`. Options: `{ userId?, scope? }`. Uses `defaultUserId` from the provider when `userId` is omitted.
- **useUserRoles(options?)** — Returns `{ roles, isLoading, error }`. Options: `{ userId?, scope? }`.
- **useRequirePermission(permission, options?)** — Throws when the user is not allowed (use an error boundary to show a denied state).
- **PermissionGate** — Renders `children` when allowed, `fallback` when denied, and `loadingFallback` (optional) while loading.

```tsx
import {
  useCanUser,
  useUserRoles,
  useRequirePermission,
  PermissionGate,
} from "@djpanda/convex-authz/react";

function DocumentList() {
  const { allowed, isLoading } = useCanUser("documents:read");

  if (isLoading) return <Spinner />;
  if (!allowed) return <p>You cannot view documents.</p>;
  return <div>{/* list */}</div>;
}

function AdminPanel() {
  useRequirePermission("settings:manage"); // throws if denied; wrap in error boundary
  return <div>Admin content</div>;
}

function EditButton({ docId }: { docId: string }) {
  return (
    <PermissionGate
      permission="documents:update"
      scope={{ type: "document", id: docId }}
      fallback={<span>No access</span>}
      loadingFallback={<span>Checking…</span>}
    >
      <button>Edit</button>
    </PermissionGate>
  );
}
```

Convex’s reactivity ensures that when permissions or roles change on the backend, the hooks and `PermissionGate` re-run and the UI updates automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           @djpanda/convex-authz                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │      RBAC        │  │      ABAC        │  │         ReBAC            │   │
│  │  Role-Based      │  │  Attribute-Based │  │  Relationship-Based      │   │
│  │  Access Control  │  │  Access Control  │  │  Access Control          │   │
│  │                  │  │                  │  │                          │   │
│  │  • Roles         │  │  • User attrs    │  │  • Tuples (S, R, O)      │   │
│  │  • Permissions   │  │  • Policies      │  │  • Graph traversal       │   │
│  │  • Scopes        │  │  • Conditions    │  │  • Inheritance           │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│           │                    │                         │                  │
│           ▼                    ▼                         ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    O(1) Indexed Permission Cache                     │   │
│  │                                                                      │   │
│  │   effectivePermissions  │  effectiveRoles  │  effectiveRelationships │   │
│  │   [user, perm, scope]   │  [user, role]    │  [subject, rel, object] │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## RBAC (Role-Based Access Control)

### Assigning Roles

```typescript
// Global role
await authz.assignRole(ctx, userId, "admin");

// Scoped role (e.g., admin of a specific team)
await authz.assignRole(ctx, userId, "admin", {
  type: "team",
  id: "team_123",
});

// With expiration (24 hours)
await authz.assignRole(ctx, userId, "admin", undefined, Date.now() + 86400000);
```

### Revoking Roles

```typescript
await authz.revokeRole(ctx, userId, "admin");

// Scoped
await authz.revokeRole(ctx, userId, "admin", { type: "team", id: "team_123" });
```

### Checking Permissions

```typescript
// Boolean check
const canEdit = await authz.can(ctx, userId, "documents:update");

// Throws if denied
await authz.require(ctx, userId, "documents:update");

// With scope
const canEditTeamDocs = await authz.can(ctx, userId, "documents:update", {
  type: "team",
  id: "team_123",
});
```

### Checking Roles

```typescript
const isAdmin = await authz.hasRole(ctx, userId, "admin");

// Scoped
const isTeamAdmin = await authz.hasRole(ctx, userId, "admin", {
  type: "team",
  id: "team_123",
});
```

### Wildcard and pattern-matching permissions

Permission checks and overrides support **wildcard patterns** so you can grant or deny whole families of permissions in one go.

**Pattern format:** `resource:action`. Either `resource` or `action` (or both) may be `*`:


| Pattern       | Meaning                       | Example matches                      |
| ------------- | ----------------------------- | ------------------------------------ |
| `*`           | All permissions               | `documents:read`, `settings:manage`  |
| `documents:`* | All actions on `documents`    | `documents:read`, `documents:update` |
| `*:read`      | Read on any resource          | `documents:read`, `settings:read`    |
| `*:*`         | All permissions (same as `*`) | any `resource:action`                |


**Checking:** When you call `can(ctx, userId, "documents:read")` or `require(ctx, userId, "documents:read")`, the backend treats any stored role or override that *matches* that permission as granting it. So if the user has a role with `documents:`* or an override `*:read`, they are allowed for `documents:read`.

**Allocation:** You can pass a pattern into `grantPermission` and `denyPermission`:

```typescript
// Grant all document actions
await authz.grantPermission(ctx, userId, "documents:*", undefined, "Full document access");

// Deny read on any resource
await authz.denyPermission(ctx, userId, "*:read", undefined, "Read access revoked");

// Remove the direct override and fall back to role/policy-derived access
await authz.removeOverride(ctx, userId, "*:read");
```

**Role definitions:** When the component evaluates permissions, it matches the requested permission against each role’s permission list using the same pattern rules. So if a role’s permissions include `"documents:*"` (in the flattened role–permission map), then `can(ctx, userId, "documents:read")` is allowed. With `defineRoles` you typically list concrete actions per resource (e.g. `documents: ["read", "update"]`); to use patterns in roles you would supply a role-permission map that includes pattern strings for that role.

**Client-side helper:** To test whether a pattern matches a permission without calling the backend, use the exported helper:

```typescript
import { matchesPermissionPattern } from "@djpanda/convex-authz";

matchesPermissionPattern("documents:read", "documents:*"); // true
matchesPermissionPattern("documents:read", "*:read");      // true
matchesPermissionPattern("settings:read", "documents:*"); // false
```

The same wildcard behavior applies to all permission checks.

### Getting User Roles

```typescript
const roles = await authz.getUserRoles(ctx, userId);
// Returns: [{ role: "admin", scopeKey: "global" }, { role: "editor", scopeKey: "team:123", scope: { type: "team", id: "123" } }]
```

### Custom roles (tenant-defined, opt-in)

For B2B SaaS apps where tenant admins need to define their own role bundles
(e.g. "Senior Editor", "Approver", "Outside Counsel"), enable the `customRoles`
option on the `Authz` constructor. Tenants compose roles from a SaaS-provider-
defined whitelist of permissions — they cannot invent new permission strings
at runtime, which keeps the type-safety win above intact and prevents
permission-escalation footguns.

#### Configure the whitelist

```typescript
const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: "tenant-acme",
  customRoles: {
    enabled: true,
    grantablePermissions: [
      "documents:read",
      "documents:update",
      "documents:delete",
      "settings:view",
    ] as const,                  // typed against PermissionArg<P> — typos rejected at compile time
    maxRolesPerTenant: 50,        // optional, default 100
  },
});
```

#### Lifecycle

```typescript
// Tenant admin creates a custom role
const roleId = await authz.createCustomRole(ctx, {
  name: "Senior Editor",
  permissions: ["documents:read", "documents:update"],
  description: "Can edit but not delete",
  createdBy: currentUserId,
});

// Assign / revoke (same shape as system roles, but with the branded id)
await authz.assignCustomRole(ctx, userId, roleId);
await authz.revokeCustomRole(ctx, userId, roleId);

// Permission checks are unchanged — `can()` doesn't care where a permission came from
const canEdit = await authz.can(ctx, userId, "documents:update");

// Update propagates to every assigned user via recomputeUser
const result = await authz.updateCustomRole(ctx, {
  customRoleId: roleId,
  permissions: ["documents:read", "documents:update", "documents:delete"],
});
// → { permissionsChanged: true, usersRecomputed: 17 }

// List / lookup
const page = await authz.listCustomRoles(ctx, { numItems: 50, cursor: null });
const role = await authz.getCustomRole(ctx, roleId);
const byName = await authz.getCustomRoleByName(ctx, "Senior Editor");

// Delete (refuses if any user holds the role unless `force: true`)
await authz.deleteCustomRole(ctx, { customRoleId: roleId, force: true });
```

#### Design decisions worth knowing

- **Composition only, never new permissions.** Tenant admins compose existing
  permissions; the whitelist enforced at create/update time is the security
  boundary.
- **Branded `CustomRoleId`.** Cannot be confused with system role names
  (`keyof R`) or with raw strings at compile time.
- **Snapshot semantics from system roles.** A custom role's `permissions[]`
  is a snapshot at create time. If the SaaS provider later updates a system
  role definition, custom roles built around the old set do not auto-update —
  preventing surprise breakage on redeploy.
- **Cascade on definition update.** When a tenant admin edits a custom role's
  permissions, every user holding it is re-materialized via `recomputeUser`.
  Direct grants and direct denies on each user are preserved.
- **Permission-check hot path is unchanged.** `can()` reads `effectivePermissions`
  identically — custom-role-derived rows are indistinguishable from system-role-
  derived rows. Zero performance impact for permission checks regardless of
  whether the feature is enabled.

---

## Bulk operations and offboarding

For large-scale or enterprise workflows, the API supports bulk permission checks (up to 100 permissions) and role updates (up to 20 roles) in a single call.

### Bulk permission check (canAny)

Check whether the user has **any** of the given permissions in one round-trip:

```typescript
const allowed = await authz.canAny(ctx, userId, [
  "documents:read",
  "documents:update",
  "documents:delete",
], scope);
// true if the user has at least one of these permissions
```

### Bulk role assign and revoke

Assign or revoke multiple roles for one user in a **single transaction**:

```typescript
// Assign multiple roles at once (max 20 per call)
const { assigned, assignmentIds } = await authz.assignRoles(ctx, userId, [
  { role: "admin" },
  { role: "editor", scope: { type: "team", id: "team_1" } },
  { role: "viewer", scope: { type: "org", id: "org_1" }, expiresAt: Date.now() + 86400000 },
], actorId);

// Revoke multiple roles at once (max 20 per call)
const { revoked } = await authz.revokeRoles(ctx, userId, [
  { role: "editor", scope: { type: "team", id: "team_1" } },
  { role: "viewer" },
], actorId);
```

### Revoke all roles

Revoke every role for a user (optionally only in a given scope):

```typescript
const count = await authz.revokeAllRoles(ctx, userId);
const countScoped = await authz.revokeAllRoles(ctx, userId, { type: "team", id: "team_1" }, actorId);
```

### Full user offboarding

Remove all roles, permission overrides, attributes, and optionally ReBAC relationships for a user in one call (optionally scoped). Also clears indexed `effectiveRoles`, `effectivePermissions`, and `effectiveRelationships` when present:

```typescript
const result = await authz.offboardUser(ctx, userId, {
  scope: { type: "org", id: "org_1" },  // optional: only remove data in this scope
  actorId: "system",
  removeAttributes: true,   // default true
  removeOverrides: true,    // default true
  removeRelationships: true, // default true when no scope (full offboard)
});
// result: { rolesRevoked, overridesRemoved, attributesRemoved, relationshipsRemoved, effectiveRolesRemoved, effectivePermissionsRemoved, effectiveRelationshipsRemoved }
```

When **scope is omitted**, the call performs a full deprovision: all roles, overrides, attributes, and all ReBAC relationships where the user is the subject are removed. When scope is provided, only data in that scope is removed and relationships are left unchanged.

### User deprovisioning (full wipe)

For security incident response, enterprise offboarding, or single-button deactivation, use **deprovisionUser** to atomically wipe all roles, attributes, relationships, and permission overrides for a user (no scope, no options):

```typescript
const result = await authz.deprovisionUser(ctx, userId, {
  actorId: "security-team",
  enableAudit: true,
});
// result: { rolesRevoked, overridesRemoved, attributesRemoved, relationshipsRemoved, effectiveRolesRemoved, effectivePermissionsRemoved, effectiveRelationshipsRemoved }
```

Bulk arrays are limited per call: permissions in `canAny` up to **100 items**, roles in `assignRoles` / `revokeRoles` up to **20 items**. The client and component validate and throw a clear error if exceeded.

---

## ABAC (Attribute-Based Access Control)

### Setting User Attributes

```typescript
await authz.setAttribute(ctx, userId, "department", "engineering");
await authz.setAttribute(ctx, userId, "clearanceLevel", 5);
await authz.setAttribute(ctx, userId, "location", { country: "US", state: "CA" });
```

### Getting Attributes

```typescript
const attributes = await authz.getUserAttributes(ctx, userId);
// Returns: [{ key: "department", value: "engineering" }, { key: "clearanceLevel", value: 5 }]
```

### Defining Policies

The `condition` function may return either a `boolean` or a `Promise<boolean>`, so you can use async logic (e.g. querying the database or calling external APIs).

```typescript
import { definePolicies, evaluatePolicyCondition } from "@djpanda/convex-authz";

const policies = definePolicies({
  "documents:update": {
    // User can update if they own the document (sync)
    condition: (ctx) => ctx.resource?.ownerId === ctx.subject.userId,
    message: "Only document owners can update",
  },
  "reports:view": {
    // Only engineering department with clearance >= 3 (sync)
    condition: (ctx) => 
      ctx.subject.attributes.department === "engineering" &&
      (ctx.subject.attributes.clearanceLevel as number) >= 3,
    message: "Requires engineering department with clearance level 3+",
  },
  "documents:delete": {
    // Async: e.g. check external service or fetch extra data
    condition: async (ctx) => {
      const doc = await getDocument(ctx.resource?.id);
      return doc != null && doc.ownerId === ctx.subject.userId;
    },
    message: "Only document owners can delete",
  },
});

const authz = new Authz(components.authz, { permissions, roles, policies, tenantId: "my-app" });
```

When you **evaluate** a policy (e.g. after RBAC allows), always **await** the condition so both sync and async policies work. Use `evaluatePolicyCondition` to normalize to a Promise:

```typescript
const policy = policies["documents:update"];
if (policy) {
  const allowed = await evaluatePolicyCondition(policy.condition, policyCtx);
  if (!allowed) throw new Error(policy.message ?? "Permission denied");
}
```

### Policy Context

Policies receive a context object with:

```typescript
interface PolicyContext {
  subject: {
    userId: string;
    roles: string[];
    attributes: Record<string, unknown>;
  };
  resource?: {
    type: string;
    id: string;
    [key: string]: unknown; // Resource data
  };
  action: string; // The permission being checked
  environment?: {
    timestamp: number;
    ip?: string;
  };
  hasRole: (role: string) => boolean;
  hasAttribute: (key: string) => boolean;
  getAttribute: <T = unknown>(key: string, defaultValue?: T) => T | undefined;
}
```

**API note:** Existing sync conditions remain valid. There is no breaking change; only the return type is widened to allow `Promise<boolean>` for async policies.

---

## ReBAC (Relationship-Based Access Control)

ReBAC enables access control based on relationships between entities, perfect for hierarchical systems like CRMs, document sharing, and organizational structures.

### Relationship Model

Relationships are stored as tuples: `(subject, relation, object)`

```
user:alice  ──member──►  team:sales
team:sales  ──owner──►   account:acme
account:acme ──parent──► deal:big_deal
```

### Adding Relationships

```typescript
// Use the Authz client — NOT direct component calls
// User is member of team
await authz.addRelation(ctx, { type: "user", id: "alice" }, "member", { type: "team", id: "sales" });

// Team owns account
await authz.addRelation(ctx, { type: "team", id: "sales" }, "owner", { type: "account", id: "acme" });
```

### Checking Direct Relationships

```typescript
// Use the Authz client — NOT direct component calls
const isMember = await authz.hasRelation(ctx, { type: "user", id: "alice" }, "member", { type: "team", id: "sales" });
// Returns: true

// To remove a relationship
await authz.removeRelation(ctx, { type: "user", id: "alice" }, "member", { type: "team", id: "sales" });
```

### Relationship Traversal (Inherited Access)

The real power of ReBAC is checking access through relationship chains:

```typescript
// Define how permissions flow through relationships
const traversalRules = {
  // A deal viewer is anyone who can view the parent account
  "deal:viewer": [
    { through: "account", via: "parent", inherit: "viewer" }
  ],
  // An account viewer is any member of the owning team
  "account:viewer": [
    { through: "team", via: "owner", inherit: "member" }
  ],
};

// Graph traversal is available via the component query directly
// Check: Can alice view big_deal?
const result = await ctx.runQuery(components.authz.rebac.checkRelationWithTraversal, {
  subjectType: "user",
  subjectId: "alice",
  relation: "viewer",
  objectType: "deal",
  objectId: "big_deal",
  traversalRules,
  maxDepth: 5,
});

// Returns:
// {
//   allowed: true,
//   path: [
//     "account:acme -[parent]-> deal:big_deal",
//     "team:sales -[owner]-> account:acme",
//     "user:alice -[member]-> team:sales"
//   ],
//   reason: "Access via relationship chain"
// }
```

Traversal uses a **maxDepth** limit (default 5) and tracks visited `(objectType, objectId, relation)` nodes so that circular relationships do not cause infinite loops.

### CRM Example

```typescript
// Setup CRM hierarchy using the Authz client
const setupCRM = async (ctx) => {
  // Sales rep Alice is on sales team
  await authz.addRelation(ctx, { type: "user", id: "alice" }, "member", { type: "team", id: "sales" });

  // Sales team owns Acme Corp account
  await authz.addRelation(ctx, { type: "team", id: "sales" }, "owner", { type: "account", id: "acme_corp" });

  // Acme Corp has a big deal
  await authz.addRelation(ctx, { type: "account", id: "acme_corp" }, "parent", { type: "deal", id: "big_deal" });

  // Now Alice can access the deal through the relationship chain!
};
```

---

## O(1) Indexed Lookups

For high-performance production use, the indexed system pre-computes permissions for instant lookups.

### Using the Indexed API

```typescript
import { Authz } from "@djpanda/convex-authz";
import { components } from "./_generated/api";

const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });

// O(1) permission check - single index lookup
const canEdit = await authz.can(ctx, userId, "documents:update");

// O(1) role check
const isAdmin = await authz.hasRole(ctx, userId, "admin");

// O(1) relationship check
const isMember = await authz.hasRelation(ctx, { type: "user", id: userId }, "member", { type: "team", id: "sales" });
```

### How It Works

```
Traditional (O(n)):                    Indexed (O(1)):
┌──────┐                               ┌──────┐
│ User │                               │ User │
└──┬───┘                               └──┬───┘
   │                                      │
   ▼                                      ▼
┌──────────┐                           ┌─────────────────────────────┐
│ Get Roles│ ◄── Query                 │ Index Lookup:               │
└──┬───────┘                           │ effectivePermissions        │
   │                                   │ [userId, permission, scope] │
   ▼                                   └─────────────────────────────┘
┌───────────────┐                                  │
│ Expand Perms  │ ◄── Loop                         ▼
└──┬────────────┘                              true/false
   │
   ▼
┌──────────────┐
│ Check Each   │ ◄── Loop
│ Permission   │
└──┬───────────┘
   │
   ▼
true/false
```

### Trade-offs


| Operation        | Traditional      | Indexed               |
| ---------------- | ---------------- | --------------------- |
| Permission Check | O(roles × perms) | **O(1)**              |
| Role Assignment  | O(1)             | O(permissions)        |
| Permission Grant | O(1)             | O(1)                  |
| Memory Usage     | Lower            | Higher (denormalized) |


**Use Indexed for production workloads with many permission checks.**

---

## Audit Logging

All authorization changes are logged for compliance and debugging.

### Automatic Logging

The following actions are automatically logged:

- `role_assigned` - When a role is assigned
- `role_revoked` - When a role is revoked
- `permission_granted` - When a direct permission is granted
- `permission_denied` - When a permission is explicitly denied
- `attribute_set` - When a user attribute is set
- `attribute_removed` - When a user attribute is removed
- `permission_check` - (Optional) When permissions are checked

### Querying the Audit Log

Without pagination options, `getAuditLog` returns a simple array (optional `limit`, default 100):

```typescript
// Get all logs for a user
const logs = await authz.getAuditLog(ctx, {
  userId: "user_123",
  limit: 50,
});

// Get logs by action type
const roleChanges = await authz.getAuditLog(ctx, {
  action: "role_assigned",
  limit: 100,
});
```

For scalable browsing, use **cursor-based pagination** by passing `numItems` (and optionally `cursor` for the next page). The return value is then `{ page, isDone, continueCursor }`:

```typescript
// First page
const result = await authz.getAuditLog(ctx, { numItems: 50 });
if (!Array.isArray(result)) {
  console.log(result.page);
  if (!result.isDone) {
    // Next page
    const next = await authz.getAuditLog(ctx, {
      numItems: 50,
      cursor: result.continueCursor,
    });
  }
}
```

### Log Entry Structure

```typescript
{
  _id: "...",
  timestamp: 1704672000000,
  actorId: "admin_user",  // Who made the change
  action: "role_assigned",
  userId: "target_user",  // Who was affected
  details: {
    role: "editor",
    scope: { type: "team", id: "team_123" },
  },
}
```

---

## Permission Overrides

Grant or deny specific permissions that override role-based assignments.

### Granting Permissions

```typescript
// Grant a permission directly (bypasses role checks)
await authz.grantPermission(ctx, userId, "documents:delete", undefined, "Temporary access for migration");

// With scope
await authz.grantPermission(ctx, userId, "documents:delete", { type: "team", id: "team_123" });

// With expiration
await authz.grantPermission(ctx, userId, "documents:delete", undefined, "Temporary", Date.now() + 3600000);
```

### Denying Permissions

```typescript
// Deny a permission (even if user has it via role)
await authz.denyPermission(ctx, userId, "documents:delete", undefined, "Access restricted");
```

### Removing Permission Overrides

`grantPermission` and `denyPermission` are **not** inverses. They upsert into
the same `permissionOverrides` row (keyed by user + permission + scope), so
calling `denyPermission` after `grantPermission` rewrites the row's `effect`
from `"allow"` to `"deny"` — the override persists, just inverted. A deny is
meaningfully different from "no override at all": a deny blocks the
permission even if the user holds it via a role, while no override lets
role-derived access flow through normally.

To truly undo an override and return to baseline (no row in
`permissionOverrides`), use `removeOverride`. After removal, role-derived
sources, deferred policy state, and role-based expiry are all properly
restored on the effective row.

```typescript
// Remove a direct grant or deny — returns true if a row was deleted, false if no
// override existed for the given (user, permission, scope) tuple. Idempotent.
const removed = await authz.removeOverride(ctx, userId, "documents:delete");

// Scope must match the original override exactly — global is distinct from scoped
await authz.removeOverride(ctx, userId, "documents:delete", { type: "team", id: "team_123" });
```

---

## Schema Reference

### Tables


| Table                    | Purpose                           |
| ------------------------ | --------------------------------- |
| `roleAssignments`        | User role assignments             |
| `userAttributes`         | User attributes for ABAC          |
| `permissionOverrides`    | Direct permission grants/denials  |
| `relationships`          | ReBAC relationship tuples         |
| `effectivePermissions`   | Pre-computed permissions (O(1))   |
| `effectiveRoles`         | Pre-computed roles (O(1))         |
| `effectiveRelationships` | Pre-computed relationships (O(1)) |
| `auditLog`               | Authorization audit trail         |


### Indexes

All tables have optimized indexes for common query patterns:

```typescript
// roleAssignments
.index("by_user", ["userId"])
.index("by_role", ["role"])
.index("by_user_and_role", ["userId", "role"])

// effectivePermissions (O(1) lookup)
.index("by_user_permission_scope", ["userId", "permission", "scopeKey"])

// relationships
.index("by_subject_relation_object", ["subjectType", "subjectId", "relation", "objectType", "objectId"])
```

---

## API Reference

### Authz Client

```typescript
class Authz<P, R, Policy> {
  // Permission checks
  can(ctx, userId, permission, scope?): Promise<boolean>
  canAny(ctx, userId, permissions: string[], scope?): Promise<boolean>   // bulk: any of N permissions (max 100)
  require(ctx, userId, permission, scope?): Promise<void>
  
  // Role management
  hasRole(ctx, userId, role, scope?): Promise<boolean>
  assignRole(ctx, userId, role, scope?, expiresAt?, actorId?): Promise<string>
  assignRoles(ctx, userId, roles: RoleAssignItem[], actorId?): Promise<{ assigned: number; assignmentIds: string[] }>  // bulk, max 20
  revokeRole(ctx, userId, role, scope?, actorId?): Promise<boolean>
  revokeRoles(ctx, userId, roles: RoleScopeItem[], actorId?): Promise<{ revoked: number }>  // bulk, max 20
  revokeAllRoles(ctx, userId, scope?, actorId?): Promise<number>
  getUserRoles(ctx, userId, scope?): Promise<Role[]>
  getUserPermissions(ctx, userId, scope?): Promise<PermissionResult>

  // Offboarding
  offboardUser(ctx, userId, options?: { scope?, actorId?, removeAttributes?, removeOverrides?, removeRelationships? }): Promise<OffboardResult>
  deprovisionUser(ctx, userId, options?: { actorId?, enableAudit? }): Promise<OffboardResult>  // full wipe: roles, overrides, attributes, relationships
  
  // Attribute management
  setAttribute(ctx, userId, key, value, actorId?): Promise<string>
  removeAttribute(ctx, userId, key, actorId?): Promise<boolean>
  getUserAttributes(ctx, userId): Promise<Attribute[]>
  
  // Permission overrides
  grantPermission(ctx, userId, permission, scope?, reason?, expiresAt?, actorId?): Promise<string>
  denyPermission(ctx, userId, permission, scope?, reason?, expiresAt?, actorId?): Promise<string>
  removeOverride(ctx, userId, permission, scope?, actorId?): Promise<boolean>
  
  // Audit
  getAuditLog(ctx, options?): Promise<AuditEntry[] | { page: AuditEntry[]; isDone: boolean; continueCursor: string }>
}
```

### Argument validation

All public methods on `Authz` validate their arguments before calling the component. Invalid inputs throw an `Error` with a clear message so you can fail fast and fix call sites.


| Argument                              | Rule                                                                                       | Example error                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `userId`                              | Non-empty string, max 512 characters                                                       | `"userId must be a non-empty string"`                                 |
| `permission`                          | Must be `resource:action` (e.g. `documents:read`)                                          | `"Invalid permission format: \"read\". Expected \"resource:action\""` |
| `scope`                               | When provided, `type` and `id` must be non-empty strings                                   | `"scope must have non-empty type when provided"`                      |
| `role`                                | Non-empty string; must be one of the roles passed at construction                          | `"Unknown role: \"superadmin\""`                                      |
| `expiresAt`                           | When provided, must be a finite number (timestamp)                                         | `"expiresAt must be a finite number"`                                 |
| Attribute `key`                       | Non-empty string                                                                           | `"Attribute key must be a non-empty string"`                          |
| `getAuditLog` `limit`                 | When provided, positive integer 1–1000                                                     | `"limit must be a positive integer when provided"`                    |
| `getAuditLog` `numItems`              | When provided (pagination), positive integer 1–1000                                        | same as `limit`                                                       |
| Relation args                         | `subjectType`, `subjectId`, `relation`, `objectType`, `objectId` must be non-empty strings | `"subjectType must be a non-empty string"`                            |
| `canAny` `permissions`                | Non-empty array, each element valid `resource:action`, length ≤ 100                        | `"permissions must not exceed 100 items"`                             |
| `assignRoles` / `revokeRoles` `roles` | Non-empty array, each role valid, length ≤ 20                                              | `"roles must not exceed 20 items"`                                    |


Optional parameters are only validated when present (e.g. omitting `scope` is valid; passing `scope: { type: "", id: "x" }` throws).

---

## Inspired by Google Zanzibar

This component implements concepts from [Google Zanzibar](https://research.google/pubs/pub48190/), Google's global authorization system that powers Google Drive, YouTube, Cloud, and more.

### Zanzibar Concepts Implemented


| Zanzibar Concept       | Our Implementation           | Description                        |
| ---------------------- | ---------------------------- | ---------------------------------- |
| **Relation Tuples**    | `relationships` table        | `(user:alice, member, team:sales)` |
| **Usersets**           | Traversal rules              | Groups defined by relationships    |
| **Check API**          | `checkPermissionFast`        | O(1) "can user X do Y on Z?"       |
| **Expand API**         | `checkRelationWithTraversal` | Find all paths granting access     |
| **Read API**           | `getSubjectRelations`        | List all relationships             |
| **Watch API**          | Convex reactivity            | Real-time permission updates       |
| **Computed Relations** | `effectivePermissions`       | Pre-computed for O(1) lookup       |


### How Zanzibar Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Google Zanzibar Model                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Relation Tuples (stored):                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  (user:alice, member, team:sales)                                  │     │
│  │  (team:sales, owner, account:acme)                                 │     │
│  │  (account:acme, parent, deal:big_deal)                             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  Authorization Model (defines inheritance):                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  type deal                                                         │     │
│  │    relations                                                       │     │
│  │      define parent: [account]                                      │     │
│  │      define viewer: viewer from parent  ← Computed relation        │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  Check: "Can alice view deal:big_deal?"                                     │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  1. deal:big_deal.viewer = viewer from parent                      │     │
│  │  2. parent = account:acme                                          │     │
│  │  3. account:acme.viewer = member from owner                        │     │
│  │  4. owner = team:sales                                             │     │
│  │  5. team:sales.member includes user:alice ✓                        │     │
│  │  → ALLOWED                                                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Zanzibar Benefits We Provide

1. **Consistency at Scale**
  - Pre-computed permissions ensure fast, consistent checks
  - No permission drift between reads
2. **Flexible Permission Model**
  - Combine RBAC, ABAC, and ReBAC as needed
  - Support complex hierarchies (org → team → project → resource)
3. **Auditability**
  - Full audit log of all permission changes
  - Path tracing shows WHY access was granted
4. **Real-time Updates**
  - Convex reactivity means UI updates instantly when permissions change
  - No polling required (better than Zanzibar!)

---

## Comparison with Other Solutions


| Feature       | @djpanda/convex-authz | OpenFGA    | Oso     | Cerbos  |
| ------------- | --------------------- | ---------- | ------- | ------- |
| RBAC          | ✅                     | ✅          | ✅       | ✅       |
| ABAC          | ✅                     | ⚠️ Limited | ✅       | ✅       |
| ReBAC         | ✅                     | ✅ Native   | ✅       | ⚠️      |
| O(1) Lookups  | ✅                     | ✅          | ✅       | ✅       |
| Convex Native | ✅                     | ❌          | ❌       | ❌       |
| Type Safety   | ✅ TypeScript          | DSL        | Polar   | YAML    |
| Real-time     | ✅ Convex queries      | Polling    | Polling | Polling |
| Self-hosted   | ✅                     | ✅          | ✅       | ✅       |


---

## Testing

### Running Package Tests

```bash
cd packages/authz
npm test
```

### Using with convex-test

```typescript
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./component/schema.js";
import { api } from "./component/_generated/api.js";

describe("authorization", () => {
  it("should assign and check roles", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.mutations.assignRole, {
      userId: "user_123",
      role: "admin",
    });

    const hasRole = await t.query(api.queries.hasRole, {
      userId: "user_123",
      role: "admin",
    });

    expect(hasRole).toBe(true);
  });
});
```

---

## Multi-Tenant Data Isolation

Every table in the authz component includes a required `tenantId` field as the leading column in every database index. This provides database-level data isolation between tenants — queries for one tenant can never return data from another.

### tenantId vs scope


|                 | `tenantId`                    | `scope`                               |
| --------------- | ----------------------------- | ------------------------------------- |
| **Purpose**     | Data isolation boundary       | Resource-level grouping               |
| **Enforcement** | Database-level (index prefix) | Application-level (query filter)      |
| **Required**    | Always                        | Optional                              |
| **Example**     | `"acme-corp"`                 | `{ type: "project", id: "proj-123" }` |


- **tenantId** answers: "whose data is this?" — the organization/customer boundary
- **scope** answers: "within this tenant, what resource does this apply to?" — e.g. admin of a specific project

### Configuration

```typescript
// Single-tenant apps — pass any constant string
const authz = new Authz(components.authz, {
  permissions, roles,
  tenantId: "my-app",
});

// Multi-tenant apps — pass the current organization/tenant ID
const authz = new Authz(components.authz, {
  permissions, roles,
  tenantId: currentOrgId,
});
```

### Cross-tenant operations

For rare admin operations that need to access a different tenant's data, use the `withTenant()` method:

```typescript
// Returns a new Authz instance scoped to a different tenant
const otherTenant = authz.withTenant("other-org-id");
await otherTenant.getUserRoles(ctx, userId);
```

### Compliance

The `tenantId`-first index design satisfies SOC2 and HIPAA data isolation requirements:

- All queries are partitioned by tenant at the database index level
- Cross-tenant data access is structurally impossible through the standard API
- `tenantId` is required in the constructor — it cannot be accidentally omitted

---

## Best Practices

### 1. Use Scoped Roles for Multi-tenancy

```typescript
// Don't: Global admin
await authz.assignRole(ctx, userId, "admin");

// Do: Scoped admin
await authz.assignRole(ctx, userId, "admin", { type: "org", id: orgId });
```

### 2. Use the Authz Client for Production

```typescript
// Authz uses O(1) indexed lookups by default — no separate class needed
const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
```

### 3. Use ReBAC for Complex Hierarchies

```typescript
// CRM, document sharing, org charts → ReBAC
// Simple role assignments → RBAC
```

### 4. Set Expiration for Temporary Access

```typescript
await authz.assignRole(ctx, userId, "contractor", undefined, 
  Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
);
```

### 5. Always Use Audit Logging

The audit log is invaluable for:

- Compliance (SOC2, GDPR)
- Debugging access issues
- Security incident investigation

### 6. Cleanup of Expired Data (Scheduled via Component)

Expired role assignments and permission overrides (and their indexed rows) are purged by a **scheduled cleanup job** that you enable once—no need to add `convex/crons.ts` yourself. The component embeds [@convex-dev/crons](https://www.convex.dev/components/crons); run this **once** after installing the component to register the daily job:

```bash
npx convex run authz/cronSetup:ensureCleanupCronRegistered
```

Or from an init script that runs on deploy (e.g. `convex/init.ts` invoked via `convex dev --run init`):

```typescript
await ctx.runMutation(components.authz.cronSetup.ensureCleanupCronRegistered, {});
```

The job runs every 24 hours and cleans `roleAssignments`, `permissionOverrides`, `effectiveRoles`, and `effectivePermissions`. Optional: you can instead define the cleanup in your app's `convex/crons.ts` or run `components.authz.mutations.runScheduledCleanup` manually.

### 6.1. Audit log retention

To avoid unbounded growth of the audit log (compliance and cost), the same cron registration also schedules a **daily audit retention job**. Configure it with Convex environment variables (Dashboard or CLI):


| Variable                      | Description                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AUDIT_RETENTION_DAYS`        | Delete entries older than this many days (e.g. `90`). Omit or `0` = do not prune by age.                            |
| `AUDIT_RETENTION_MAX_ENTRIES` | Cap total entries by deleting oldest until count ≤ this value (e.g. `100000`). Omit or `0` = do not prune by count. |


Set at least one to enable retention. The job runs every 24 hours (same `ensureCleanupCronRegistered` flow). You can also run `components.authz.mutations.runAuditRetentionCleanup` manually with optional args `{ maxAgeDays?, maxEntries? }` to override env for that run.

### 7. Use Authz as a Global Singleton

Authz is a **global component** — install it once and share a single client instance across your entire app. Do not create multiple `Authz` instances per app.

```
convex/
  convex.config.ts   ← app.use(authz) — registered once
  authz.ts           ← definePermissions, defineRoles, export authz client
  documents.ts       ← import { authz } from "./authz"
  billing.ts         ← import { authz } from "./authz"
  settings.ts        ← import { authz } from "./authz"
```

```typescript
// convex/authz.ts — single source of truth
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { components } from "./_generated/api";

const permissions = definePermissions({
  documents: { create: true, read: true, update: true, delete: true },
  billing: { view: true, manage: true },
  settings: { view: true, manage: true },
});

const roles = defineRoles(permissions, {
  admin: {
    documents: ["create", "read", "update", "delete"],
    billing: ["view", "manage"],
    settings: ["view", "manage"],
  },
  viewer: {
    documents: ["read"],
    settings: ["view"],
  },
});

// Export the single authz client — import this everywhere
export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
```

```typescript
// convex/documents.ts — uses the shared client
import { mutation } from "./_generated/server";
import { authz } from "./authz";

export const deleteDocument = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    await authz.require(ctx, userId, "documents:delete");
    // ...
  },
});
```

### 7. Organize Permissions by Domain

In larger apps, split permission and role definitions by domain and merge them into a single authz client using `definePermissions` and `defineRoles`:

```typescript
// convex/permissions/documents.ts
export const documentPermissions = {
  documents: { create: true, read: true, update: true, delete: true },
};
export const documentRoles = {
  editor: { documents: ["create", "read", "update"] as const },
  viewer: { documents: ["read"] as const },
};

// convex/permissions/billing.ts
export const billingPermissions = {
  billing: { view: true, manage: true },
};
export const billingRoles = {
  billing_admin: { billing: ["view", "manage"] as const },
};
```

```typescript
// convex/authz.ts — merge all domains
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { components } from "./_generated/api";
import { documentPermissions, documentRoles } from "./permissions/documents";
import { billingPermissions, billingRoles } from "./permissions/billing";

const permissions = definePermissions(documentPermissions, billingPermissions);
const roles = defineRoles(permissions, documentRoles, billingRoles);

export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
```

This keeps each domain self-contained while producing a single, type-safe authz client.

### 8. Integrating with Other Convex Components

When other Convex components (e.g., `@djpanda/convex-tenants`) need authorization, they share the **same global authz instance**. The pattern:

1. Register both components independently in `convex.config.ts`
2. The other component exports its required permissions and roles
3. Merge them with your app's own definitions
4. Pass the authz client to the other component's API factory

```mermaid
graph LR
  subgraph app ["Your App (convex.config.ts)"]
    AuthzComp["authz component"]
    TenantsComp["tenants component"]
  end

  subgraph authzSetup ["convex/authz.ts"]
    AppPerms["App permissions"]
    TenantPerms["Tenant permissions"]
    Merge["definePermissions + defineRoles"]
    Client["authz client (singleton)"]
    AppPerms --> Merge
    TenantPerms --> Merge
    Merge --> Client
  end

  Client -->|"import { authz }"| Docs["convex/documents.ts"]
  Client -->|"import { authz }"| Billing["convex/billing.ts"]
  Client -->|"passed to makeTenantsAPI"| TenantsAPI["convex/tenants.ts"]
```



```typescript
// convex/convex.config.ts — register both components
import { defineApp } from "convex/server";
import authz from "@djpanda/convex-authz/convex.config";
import tenants from "@djpanda/convex-tenants/convex.config";

const app = defineApp();
app.use(authz);
app.use(tenants);
export default app;
```

```typescript
// convex/authz.ts — merge app + component permissions
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";

// Your app's own permissions
const appPermissions = {
  documents: { create: true, read: true, update: true, delete: true },
};
const appRoles = {
  editor: { documents: ["create", "read", "update"] as const },
};

// Merge with tenant component's permissions
const permissions = definePermissions(appPermissions, TENANTS_PERMISSIONS);
const roles = defineRoles(permissions, appRoles, TENANTS_ROLES);

export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });
```

```typescript
// convex/tenants.ts — pass the shared authz client
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";
import { authz } from "./authz";

export const {
  createOrg,
  inviteMember,
  removeMember,
  // ...
} = makeTenantsAPI(components.tenants, {
  authz,
  creatorRole: "owner",
  auth: async (ctx) => {
    // return the current user ID
  },
});
```

This way every part of your app — your own functions and third-party components — shares a single, consistent authorization layer.

---


---

## Development

```bash
# Install dependencies
npm install

# Run development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Type check
npm run typecheck
```

---

## File Structure

```
packages/authz/
├── package.json          # Package configuration
├── README.md             # This documentation
├── src/
│   ├── client/
│   │   ├── index.ts      # Main exports (Authz, helpers)
│   │   └── index.test.ts # Client tests
│   ├── component/
│   │   ├── convex.config.ts  # Component registration
│   │   ├── schema.ts         # Database tables and indexes
│   │   ├── helpers.ts        # Shared utilities
│   │   ├── queries.ts        # Query functions
│   │   ├── mutations.ts      # Mutation functions
│   │   ├── rebac.ts          # ReBAC relationship functions
│   │   ├── indexed.ts        # O(1) indexed functions
│   │   ├── authz.test.ts     # RBAC/ABAC tests
│   │   ├── rebac.test.ts     # ReBAC tests
│   │   ├── indexed.test.ts   # O(1) indexed tests
│   │   └── _generated/       # Auto-generated types
│   └── test.ts           # Test helpers
└── example/              # Example app
```

---

## License

MIT

---

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.
