# @dbjpanda/convex-authz

A comprehensive **RBAC/ABAC/ReBAC** authorization component for [Convex](https://convex.dev) with **O(1) indexed lookups**, inspired by [Google Zanzibar](https://research.google/pubs/pub48190/).

[![npm version](https://badge.fury.io/js/@dbjpanda%2Fconvex-authz.svg)](https://www.npmjs.com/package/@dbjpanda/convex-authz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

| Feature | Description |
|---------|-------------|
| **RBAC** | Role-Based Access Control with scoped roles |
| **ABAC** | Attribute-Based Access Control with custom policies |
| **ReBAC** | Relationship-Based Access Control with graph traversal |
| **O(1) Lookups** | Pre-computed permissions for instant checks |
| **Type Safety** | Full TypeScript support with type-safe permissions |
| **Audit Logging** | Track all permission changes and checks |
| **Convex Native** | Built specifically for Convex, with real-time updates |

## Installation

```bash
npm install @dbjpanda/convex-authz
```

## Quick Start

### 1. Register the Component

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import authz from "@dbjpanda/convex-authz/convex.config";

const app = defineApp();
app.use(authz);

export default app;
```

### 2. Define Permissions and Roles

```typescript
// convex/authz.ts
import { Authz, definePermissions, defineRoles } from "@dbjpanda/convex-authz";
import { components } from "./_generated/api";

// Step 1: Define your permissions
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

// Step 2: Define roles with their permissions
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
export const authz = new Authz(components.authz, {
  permissions,
  roles,
});
```

### 3. Use in Your Functions

```typescript
// convex/documents.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authz } from "./authz";

export const updateDocument = mutation({
  args: { docId: v.id("documents"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Check permission (throws if denied)
    await authz.require(ctx, userId, "documents:update");

    // Or check with boolean
    const canUpdate = await authz.can(ctx, userId, "documents:update");

    // Scoped permission check
    await authz.require(ctx, userId, "documents:update", {
      type: "team",
      id: "team_123",
    });

    // Proceed with update...
  },
});
```

## O(1) Indexed Lookups

For production workloads, use `IndexedAuthz` for instant permission checks:

```typescript
import { IndexedAuthz } from "@dbjpanda/convex-authz";

const authz = new IndexedAuthz(components.authz, {
  permissions,
  roles,
});

// O(1) permission check via pre-computed index
const canEdit = await authz.can(ctx, userId, "documents:update");
```

### Trade-offs

| Operation | Standard | Indexed |
|-----------|----------|---------|
| Permission Check | O(roles × perms) | **O(1)** |
| Role Assignment | O(1) | O(permissions) |
| Memory Usage | Lower | Higher |

## ReBAC (Relationship-Based Access Control)

Perfect for CRMs, document sharing, and organizational structures:

```typescript
// Define relationships
await ctx.runMutation(components.authz.rebac.addRelation, {
  subjectType: "user",
  subjectId: "alice",
  relation: "member",
  objectType: "team",
  objectId: "sales",
});

// Check with traversal (alice → team → account → deal)
const result = await ctx.runQuery(
  components.authz.rebac.checkRelationWithTraversal,
  {
    subjectType: "user",
    subjectId: "alice",
    relation: "viewer",
    objectType: "deal",
    objectId: "big_deal",
    traversalRules: {
      "deal:viewer": [
        { through: "account", via: "parent", inherit: "viewer" },
      ],
      "account:viewer": [
        { through: "team", via: "owner", inherit: "member" },
      ],
    },
  }
);
// result.allowed = true, with full path explanation
```

## API Reference

### Authz Client

```typescript
class Authz<P, R, Policy> {
  // Permission checks
  can(ctx, userId, permission, scope?): Promise<boolean>
  require(ctx, userId, permission, scope?): Promise<void>

  // Role management
  assignRole(ctx, userId, role, scope?, expiresAt?): Promise<string>
  revokeRole(ctx, userId, role, scope?): Promise<boolean>
  hasRole(ctx, userId, role, scope?): Promise<boolean>
  getUserRoles(ctx, userId, scope?): Promise<Role[]>

  // Attribute management (ABAC)
  setAttribute(ctx, userId, key, value): Promise<string>
  removeAttribute(ctx, userId, key): Promise<boolean>
  getUserAttributes(ctx, userId): Promise<Attribute[]>

  // Permission overrides
  grantPermission(ctx, userId, permission, scope?, reason?): Promise<string>
  denyPermission(ctx, userId, permission, scope?, reason?): Promise<string>

  // Audit
  getAuditLog(ctx, options?): Promise<AuditEntry[]>
}
```

### IndexedAuthz Client

```typescript
class IndexedAuthz<P, R> {
  // O(1) checks
  can(ctx, userId, permission, scope?): Promise<boolean>
  require(ctx, userId, permission, scope?): Promise<void>
  hasRole(ctx, userId, role, scope?): Promise<boolean>
  hasRelation(ctx, subject, relation, object): Promise<boolean>

  // Mutations (compute on write)
  assignRole(ctx, userId, role, scope?, expiresAt?): Promise<string>
  revokeRole(ctx, userId, role, scope?): Promise<boolean>

  // ReBAC
  addRelation(ctx, subject, relation, object): Promise<string>
  removeRelation(ctx, subject, relation, object): Promise<boolean>
}
```

## Testing

Use with `convex-test`:

```typescript
import { convexTest } from "convex-test";
import authzTest from "@dbjpanda/convex-authz/test";
import { test } from "vitest";

test("authorization test", async () => {
  const t = convexTest(schema, modules);
  authzTest.register(t, "authz");

  // Your tests here
});
```

## Inspired by Google Zanzibar

This component implements key concepts from Google's Zanzibar authorization system:

| Zanzibar Concept | Our Implementation |
|------------------|-------------------|
| Relation Tuples | `relationships` table |
| Check API | `checkPermissionFast` (O(1)) |
| Expand API | `checkRelationWithTraversal` |
| Computed Relations | `effectivePermissions` table |

## Comparison

| Feature | @dbjpanda/convex-authz | OpenFGA | Oso |
|---------|------------------|---------|-----|
| RBAC | ✅ | ✅ | ✅ |
| ABAC | ✅ | ⚠️ | ✅ |
| ReBAC | ✅ | ✅ | ✅ |
| O(1) Lookups | ✅ | ✅ | ✅ |
| Convex Native | ✅ | ❌ | ❌ |
| Real-time | ✅ | Polling | Polling |

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
```

## License

MIT

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.
