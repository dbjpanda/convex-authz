/**
 * Demo Data Constants
 *
 * Defines the structure for the example application.
 */

export const DEMO_PERMISSIONS = {
  documents: ["create", "read", "update", "delete"],
  settings: ["view", "manage"],
  users: ["invite", "remove", "manage"],
  billing: ["view", "manage"],
} as const;

export const DEMO_ROLES = {
  admin: {
    label: "Admin",
    description: "Full access to all resources",
    permissions: [
      "documents:create",
      "documents:read",
      "documents:update",
      "documents:delete",
      "settings:view",
      "settings:manage",
      "users:invite",
      "users:remove",
      "users:manage",
      "billing:view",
      "billing:manage",
    ],
  },
  editor: {
    label: "Editor",
    description: "Can create and edit documents",
    permissions: [
      "documents:create",
      "documents:read",
      "documents:update",
      "settings:view",
    ],
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access",
    permissions: ["documents:read", "settings:view"],
  },
  billing_admin: {
    label: "Billing Admin",
    description: "Manages billing and subscriptions",
    permissions: ["billing:view", "billing:manage", "settings:view"],
  },
} as const;

export const DEMO_USERS = [
  {
    name: "Alice Anderson",
    email: "alice@acme.com",
    role: "admin",
    org: "acme",
    avatar: "AA",
  },
  {
    name: "Bob Baker",
    email: "bob@acme.com",
    role: "editor",
    org: "acme",
    avatar: "BB",
  },
  {
    name: "Charlie Chen",
    email: "charlie@acme.com",
    role: "viewer",
    org: "acme",
    avatar: "CC",
  },
  {
    name: "Diana Davis",
    email: "diana@betaco.com",
    role: "admin",
    org: "betaco",
    avatar: "DD",
  },
  {
    name: "Eve Edwards",
    email: "eve@betaco.com",
    role: "editor",
    org: "betaco",
    avatar: "EE",
  },
  {
    name: "Frank Foster",
    email: "frank@example.com",
    role: null, // No role - external contractor
    org: null,
    avatar: "FF",
  },
] as const;

export const DEMO_ORGS = [
  {
    name: "Acme Corp",
    slug: "acme",
    plan: "enterprise",
  },
  {
    name: "BetaCo",
    slug: "betaco",
    plan: "pro",
  },
] as const;

export const DEMO_DOCUMENTS = [
  {
    title: "Q4 Strategy Document",
    org: "acme",
    author: "alice@acme.com",
  },
  {
    title: "Product Roadmap 2024",
    org: "acme",
    author: "bob@acme.com",
  },
  {
    title: "Engineering Guidelines",
    org: "acme",
    author: "alice@acme.com",
  },
  {
    title: "Marketing Plan",
    org: "betaco",
    author: "diana@betaco.com",
  },
  {
    title: "Sales Playbook",
    org: "betaco",
    author: "eve@betaco.com",
  },
] as const;
