/**
 * Seed Script for @djpanda/convex-authz Example
 *
 * Creates demo users, orgs, documents, and assigns roles using the authz component.
 *
 * USAGE:
 *   npx convex run seed:seedAll
 *   npx convex run seed:clearAll
 */

import { mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { DEMO_USERS, DEMO_ORGS, DEMO_DOCUMENTS, DEMO_ROLES } from "./constants.js";

// Define permissions and roles (same as example.ts)
const permissions = definePermissions({
  documents: { create: true, read: true, update: true, delete: true },
  settings: { view: true, manage: true },
  users: { invite: true, remove: true, manage: true },
  billing: { view: true, manage: true },
});

const roles = defineRoles(permissions, {
  admin: {
    documents: ["create", "read", "update", "delete"],
    settings: ["view", "manage"],
    users: ["invite", "remove", "manage"],
    billing: ["view", "manage"],
  },
  editor: {
    documents: ["create", "read", "update"],
    settings: ["view"],
  },
  viewer: {
    documents: ["read"],
    settings: ["view"],
  },
  billing_admin: {
    billing: ["view", "manage"],
    settings: ["view"],
  },
});

const authz = new Authz(components.authz, { permissions, roles });

/**
 * Seed all demo data
 */
export const seedAll = mutation({
  args: {},
  returns: v.object({
    orgs: v.number(),
    users: v.number(),
    documents: v.number(),
    roleAssignments: v.number(),
  }),
  handler: async (ctx) => {
    console.log("🌱 Seeding @djpanda/convex-authz demo data...\n");

    // Helper: Get or create org
    const getOrCreateOrg = async (
      name: string,
      slug: string,
      plan: string
    ): Promise<Id<"orgs">> => {
      const existing = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existing) return existing._id;
      return await ctx.db.insert("orgs", { name, slug, plan });
    };

    // Helper: Get or create user
    const getOrCreateUser = async (
      name: string,
      email: string,
      avatar?: string
    ): Promise<Id<"users">> => {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existing) return existing._id;
      return await ctx.db.insert("users", { name, email, avatar });
    };

    // 1. Create organizations
    console.log("🏢 Creating organizations...");
    const orgMap: Record<string, Id<"orgs">> = {};
    for (const org of DEMO_ORGS) {
      orgMap[org.slug] = await getOrCreateOrg(org.name, org.slug, org.plan);
      console.log(`   ✓ ${org.name} (${org.slug})`);
    }

    // 2. Create users and assign roles
    console.log("\n👥 Creating users and assigning roles...");
    const userMap: Record<string, Id<"users">> = {};
    let roleAssignments = 0;

    for (const user of DEMO_USERS) {
      const userId = await getOrCreateUser(user.name, user.email, user.avatar);
      userMap[user.email] = userId;

      // Add to org if applicable
      if (user.org && orgMap[user.org]) {
        const existing = await ctx.db
          .query("org_members")
          .withIndex("by_org_user", (q) =>
            q.eq("orgId", orgMap[user.org!]).eq("userId", userId)
          )
          .first();
        if (!existing) {
          await ctx.db.insert("org_members", {
            orgId: orgMap[user.org],
            userId,
          });
        }
      }

      // Assign role if specified
      if (user.role && user.org) {
        try {
          await authz.assignRole(
            ctx,
            String(userId),
            user.role as keyof typeof roles,
            {
              type: "org",
              id: String(orgMap[user.org]),
            }
          );
          roleAssignments++;
          console.log(
            `   ✓ ${user.name} → ${user.role} @ ${user.org}`
          );
        } catch {
          // Role may already be assigned
          console.log(
            `   ⚠ ${user.name} → ${user.role} @ ${user.org} (already assigned)`
          );
        }
      } else if (!user.role) {
        console.log(`   ✓ ${user.name} (no role - external user)`);
      }
    }

    // 3. Create documents
    console.log("\n📄 Creating documents...");
    let docCount = 0;
    for (const doc of DEMO_DOCUMENTS) {
      const orgId = orgMap[doc.org];
      const authorId = userMap[doc.author];
      if (!orgId || !authorId) continue;

      // Check if doc already exists
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      if (existing.some((d) => d.title === doc.title)) {
        console.log(`   ⚠ ${doc.title} (already exists)`);
        continue;
      }

      await ctx.db.insert("documents", {
        title: doc.title,
        content: `Content of ${doc.title}`,
        orgId,
        authorId,
      });
      docCount++;
      console.log(`   ✓ ${doc.title}`);
    }

    // 4. Grant special permissions
    console.log("\n🔐 Granting special permissions...");

    // Give Frank (external user) read access to Acme docs
    const frankId = userMap["frank@example.com"];
    const acmeId = orgMap["acme"];
    if (frankId && acmeId) {
      try {
        await authz.grantPermission(ctx, String(frankId), "documents:read", {
          type: "org",
          id: String(acmeId),
        });
        console.log("   ✓ Frank → documents:read @ Acme (explicit grant)");
      } catch {
        console.log("   ⚠ Frank → documents:read @ Acme (already granted)");
      }
    }

    console.log("\n✅ Seed complete!");
    console.log(`   - Organizations: ${Object.keys(orgMap).length}`);
    console.log(`   - Users: ${Object.keys(userMap).length}`);
    console.log(`   - Documents: ${docCount}`);
    console.log(`   - Role Assignments: ${roleAssignments}\n`);

    return {
      orgs: Object.keys(orgMap).length,
      users: Object.keys(userMap).length,
      documents: docCount,
      roleAssignments,
    };
  },
});

/**
 * Clear all demo data
 */
export const clearAll = mutation({
  args: {},
  returns: v.object({
    documents: v.number(),
    orgMembers: v.number(),
    users: v.number(),
    orgs: v.number(),
  }),
  handler: async (ctx) => {
    console.log("🧹 Clearing demo data...\n");

    // Delete in order: documents → org_members → users → orgs
    const documents = await ctx.db.query("documents").collect();
    for (const doc of documents) {
      await ctx.db.delete(doc._id);
    }
    console.log(`   ✓ Deleted ${documents.length} documents`);

    const orgMembers = await ctx.db.query("org_members").collect();
    for (const member of orgMembers) {
      await ctx.db.delete(member._id);
    }
    console.log(`   ✓ Deleted ${orgMembers.length} org members`);

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      // Revoke all roles for this user
      const userRoles = await authz.getUserRoles(ctx, String(user._id));
      for (const role of userRoles) {
        try {
          await authz.revokeRole(
            ctx,
            String(user._id),
            role.role as keyof typeof roles,
            role.scope
          );
        } catch {
          // Ignore errors
        }
      }
      await ctx.db.delete(user._id);
    }
    console.log(`   ✓ Deleted ${users.length} users`);

    const orgs = await ctx.db.query("orgs").collect();
    for (const org of orgs) {
      await ctx.db.delete(org._id);
    }
    console.log(`   ✓ Deleted ${orgs.length} orgs`);

    console.log("\n✅ All demo data cleared!");

    return {
      documents: documents.length,
      orgMembers: orgMembers.length,
      users: users.length,
      orgs: orgs.length,
    };
  },
});
