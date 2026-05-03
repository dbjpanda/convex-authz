import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { scopeValidator } from "./validators";

const BATCH_SIZE = 500;

type OffboardUserArgs = {
  tenantId: string;
  userId: string;
  scope?: { type: string; id: string };
  revokedBy?: string;
  removeAttributes?: boolean;
  removeOverrides?: boolean;
  removeRelationships?: boolean;
  enableAudit?: boolean;
};

async function offboardUserImpl(
  ctx: {
    db: import("convex/server").GenericMutationCtx<
      import("./_generated/dataModel").DataModel
    >["db"];
  },
  args: OffboardUserArgs,
): Promise<{
  rolesRevoked: number;
  overridesRemoved: number;
  attributesRemoved: number;
  relationshipsRemoved: number;
  effectiveRolesRemoved: number;
  effectivePermissionsRemoved: number;
  effectiveRelationshipsRemoved: number;
}> {
  const removeAttrs = args.removeAttributes !== false;
  const removeOverridesFlag = args.removeOverrides !== false;
  const removeRels = args.removeRelationships !== false;
  const scopeKey = args.scope ? `${args.scope.type}:${args.scope.id}` : null;
  const fullDeprovision = args.scope === undefined;

  let rolesRevoked = 0;
  let overridesRemoved = 0;
  let attributesRemoved = 0;
  let relationshipsRemoved = 0;
  let effectiveRolesRemoved = 0;
  let effectivePermissionsRemoved = 0;
  let effectiveRelationshipsRemoved = 0;

  // 1. Role assignments (source table)
  const assignments = await ctx.db
    .query("roleAssignments")
    .withIndex("by_tenant_user", (q) =>
      q.eq("tenantId", args.tenantId).eq("userId", args.userId),
    )
    .take(4000);

  for (const a of assignments) {
    if (args.scope) {
      if (!a.scope) continue;
      if (a.scope.type !== args.scope.type || a.scope.id !== args.scope.id)
        continue;
    }
    await ctx.db.delete(a._id);
    rolesRevoked++;
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        timestamp: Date.now(),
        action: "role_revoked",
        userId: args.userId,
        actorId: args.revokedBy,
        details: { role: a.role, scope: a.scope },
      });
    }
  }

  // 2. Permission overrides
  if (removeOverridesFlag) {
    const overrides = await ctx.db
      .query("permissionOverrides")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.userId),
      )
      .take(4000);

    for (const o of overrides) {
      if (args.scope) {
        if (!o.scope) continue;
        if (o.scope.type !== args.scope.type || o.scope.id !== args.scope.id)
          continue;
      }
      await ctx.db.delete(o._id);
      overridesRemoved++;
    }
  }

  // 3. User attributes (no scope)
  if (removeAttrs) {
    const attributes = await ctx.db
      .query("userAttributes")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.userId),
      )
      .take(4000);

    for (const a of attributes) {
      await ctx.db.delete(a._id);
      attributesRemoved++;
      if (args.enableAudit) {
        await ctx.db.insert("auditLog", {
          tenantId: args.tenantId,
          timestamp: Date.now(),
          action: "attribute_removed",
          userId: args.userId,
          actorId: args.revokedBy,
          details: { attribute: { key: a.key } },
        });
      }
    }
  }

  // 4. ReBAC relationships (only on full deprovision, no scope)
  if (fullDeprovision && removeRels) {
    const relationships = await ctx.db
      .query("relationships")
      .withIndex("by_tenant_subject", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("subjectType", "user")
          .eq("subjectId", args.userId),
      )
      .take(4000);

    for (const r of relationships) {
      await ctx.db.delete(r._id);
      relationshipsRemoved++;
    }

    const userSubjectKey = `user:${args.userId}`;
    const effectiveRels = await ctx.db
      .query("effectiveRelationships")
      .withIndex("by_tenant_subject", (q) =>
        q.eq("tenantId", args.tenantId).eq("subjectKey", userSubjectKey),
      )
      .take(4000);

    for (const er of effectiveRels) {
      await ctx.db.delete(er._id);
      effectiveRelationshipsRemoved++;
    }
  }

  // 5. Indexed tables: effectiveRoles, effectivePermissions
  const effectiveRoles = await ctx.db
    .query("effectiveRoles")
    .withIndex("by_tenant_user", (q) =>
      q.eq("tenantId", args.tenantId).eq("userId", args.userId),
    )
    .take(4000);

  for (const r of effectiveRoles) {
    if (scopeKey !== null && r.scopeKey !== scopeKey) continue;
    await ctx.db.delete(r._id);
    effectiveRolesRemoved++;
  }

  const effectivePerms = await ctx.db
    .query("effectivePermissions")
    .withIndex("by_tenant_user", (q) =>
      q.eq("tenantId", args.tenantId).eq("userId", args.userId),
    )
    .take(4000);

  for (const p of effectivePerms) {
    if (scopeKey !== null && p.scopeKey !== scopeKey) continue;
    // Preserve direct grant/deny rows when removeOverrides=false
    if (!removeOverridesFlag && (p.directGrant || p.directDeny)) {
      // Clear role-based sources but keep the row so can() still finds it
      await ctx.db.patch(p._id, { sources: [], updatedAt: Date.now() });
      continue;
    }
    await ctx.db.delete(p._id);
    effectivePermissionsRemoved++;
  }

  return {
    rolesRevoked,
    overridesRemoved,
    attributesRemoved,
    relationshipsRemoved,
    effectiveRolesRemoved,
    effectivePermissionsRemoved,
    effectiveRelationshipsRemoved,
  };
}

/**
 * Full user offboarding: remove all roles, optional permission overrides and attributes,
 * ReBAC relationships (when no scope), and clear indexed effectiveRoles/effectivePermissions
 * and effectiveRelationships for this user (and optional scope).
 *
 * When scope is omitted, performs a full deprovision: roles, overrides, attributes,
 * and all relationships where the user is the subject are removed. Use for
 * security incident response, enterprise offboarding, or single-button deactivation.
 */
export const offboardUser = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    scope: scopeValidator,
    revokedBy: v.optional(v.string()),
    removeAttributes: v.optional(v.boolean()),
    removeOverrides: v.optional(v.boolean()),
    removeRelationships: v.optional(v.boolean()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.object({
    rolesRevoked: v.number(),
    overridesRemoved: v.number(),
    attributesRemoved: v.number(),
    relationshipsRemoved: v.number(),
    effectiveRolesRemoved: v.number(),
    effectivePermissionsRemoved: v.number(),
    effectiveRelationshipsRemoved: v.number(),
  }),
  handler: async (ctx, args) => offboardUserImpl(ctx, args),
});

/**
 * Full user deprovisioning: wipes all roles, attributes, relationships, and
 * permission overrides for a given userId in one atomic call. Convenience
 * wrapper around offboardUser with no scope and all removal options enabled.
 * Use for security incident response, enterprise offboarding, or single-button
 * deactivation.
 */
export const deprovisionUser = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    revokedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.object({
    rolesRevoked: v.number(),
    overridesRemoved: v.number(),
    attributesRemoved: v.number(),
    relationshipsRemoved: v.number(),
    effectiveRolesRemoved: v.number(),
    effectivePermissionsRemoved: v.number(),
    effectiveRelationshipsRemoved: v.number(),
  }),
  handler: async (ctx, args) =>
    offboardUserImpl(ctx, {
      tenantId: args.tenantId,
      userId: args.userId,
      revokedBy: args.revokedBy,
      removeAttributes: true,
      removeOverrides: true,
      removeRelationships: true,
      enableAudit: args.enableAudit,
    }),
});

/**
 * Remove a user attribute
 */
export const removeAttribute = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    key: v.string(),
    removedBy: v.optional(v.string()),
    enableAudit: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userAttributes")
      .withIndex("by_tenant_user_and_key", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("userId", args.userId)
          .eq("key", args.key),
      )
      .unique();

    if (!existing) {
      return false;
    }

    await ctx.db.delete(existing._id);

    // Log audit entry if enabled
    if (args.enableAudit) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        timestamp: Date.now(),
        action: "attribute_removed",
        userId: args.userId,
        actorId: args.removedBy,
        details: {
          attribute: {
            key: args.key,
          },
        },
      });
    }

    return true;
  },
});

/**
 * Clean up expired role assignments and permission overrides
 */
export const cleanupExpired = mutation({
  args: {
    tenantId: v.optional(v.string()),
  },
  returns: v.object({
    expiredRoles: v.number(),
    expiredOverrides: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let expiredRoles = 0;
    let expiredOverrides = 0;

    // Clean up expired role assignments in batches
    while (true) {
      const roleAssignments = args.tenantId
        ? await ctx.db
            .query("roleAssignments")
            .withIndex("by_tenant_user", (q) =>
              q.eq("tenantId", args.tenantId!),
            )
            .take(BATCH_SIZE)
        : await ctx.db
            .query("roleAssignments")
            .order("asc")
            .take(BATCH_SIZE);
      if (roleAssignments.length === 0) break;
      let deletedAny = false;
      for (const assignment of roleAssignments) {
        if (assignment.expiresAt && assignment.expiresAt < now) {
          await ctx.db.delete(assignment._id);
          expiredRoles++;
          deletedAny = true;
        }
      }
      // If we got fewer than BATCH_SIZE rows, we've scanned everything
      // If we got a full batch but deleted nothing, stop to avoid infinite loop
      if (roleAssignments.length < BATCH_SIZE || !deletedAny) break;
    }

    // Clean up expired permission overrides in batches
    while (true) {
      const overrides = args.tenantId
        ? await ctx.db
            .query("permissionOverrides")
            .withIndex("by_tenant_user", (q) =>
              q.eq("tenantId", args.tenantId!),
            )
            .take(BATCH_SIZE)
        : await ctx.db
            .query("permissionOverrides")
            .order("asc")
            .take(BATCH_SIZE);
      if (overrides.length === 0) break;
      let deletedAny = false;
      for (const override of overrides) {
        if (override.expiresAt && override.expiresAt < now) {
          await ctx.db.delete(override._id);
          expiredOverrides++;
          deletedAny = true;
        }
      }
      if (overrides.length < BATCH_SIZE || !deletedAny) break;
    }

    // Also clean expired effective tables
    const BATCH = 500;
    while (true) {
      const batch = args.tenantId
        ? await ctx.db.query("effectiveRoles")
            .withIndex("by_tenant_user", (q) => q.eq("tenantId", args.tenantId!))
            .take(BATCH)
        : await ctx.db.query("effectiveRoles").order("asc").take(BATCH);
      if (batch.length === 0) break;
      let deletedAny = false;
      for (const row of batch) {
        if (row.expiresAt && row.expiresAt < now) {
          await ctx.db.delete(row._id);
          deletedAny = true;
        }
      }
      if (batch.length < BATCH || !deletedAny) break;
    }

    while (true) {
      const batch = args.tenantId
        ? await ctx.db.query("effectivePermissions")
            .withIndex("by_tenant_user", (q) => q.eq("tenantId", args.tenantId!))
            .take(BATCH)
        : await ctx.db.query("effectivePermissions").order("asc").take(BATCH);
      if (batch.length === 0) break;
      let deletedAny = false;
      for (const row of batch) {
        if (row.expiresAt && row.expiresAt < now) {
          await ctx.db.delete(row._id);
          deletedAny = true;
        }
      }
      if (batch.length < BATCH || !deletedAny) break;
    }

    return { expiredRoles, expiredOverrides };
  },
});

/**
 * Scheduled cleanup job: purges all expired records from roleAssignments,
 * permissionOverrides, effectiveRoles, and effectivePermissions.
 * Intended to be run periodically via Convex crons (e.g. daily).
 *
 * The cleanup cron is auto-registered when you use the component (e.g. assignRole or this mutation).
 * You can also define it manually in your app's convex/crons.ts if you prefer.
 */
export const runScheduledCleanup = mutation({
  args: {
    tenantId: v.optional(v.string()),
  },
  returns: v.object({
    expiredRoleAssignments: v.number(),
    expiredOverrides: v.number(),
    expiredEffectiveRoles: v.number(),
    expiredEffectivePermissions: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let expiredRoleAssignments = 0;
    let expiredOverrides = 0;
    let expiredEffectiveRoles = 0;
    let expiredEffectivePermissions = 0;

    // 1. Source tables: roleAssignments, permissionOverrides
    while (true) {
      const roleAssignments = args.tenantId
        ? await ctx.db
            .query("roleAssignments")
            .withIndex("by_tenant_user", (q) =>
              q.eq("tenantId", args.tenantId!),
            )
            .take(BATCH_SIZE)
        : await ctx.db
            .query("roleAssignments")
            .order("asc")
            .take(BATCH_SIZE);
      if (roleAssignments.length === 0) break;
      let deletedAny = false;
      for (const assignment of roleAssignments) {
        if (assignment.expiresAt && assignment.expiresAt < now) {
          await ctx.db.delete(assignment._id);
          expiredRoleAssignments++;
          deletedAny = true;
        }
      }
      if (roleAssignments.length < BATCH_SIZE || !deletedAny) break;
    }

    while (true) {
      const overrides = args.tenantId
        ? await ctx.db
            .query("permissionOverrides")
            .withIndex("by_tenant_user", (q) =>
              q.eq("tenantId", args.tenantId!),
            )
            .take(BATCH_SIZE)
        : await ctx.db
            .query("permissionOverrides")
            .order("asc")
            .take(BATCH_SIZE);
      if (overrides.length === 0) break;
      let deletedAny = false;
      for (const override of overrides) {
        if (override.expiresAt && override.expiresAt < now) {
          await ctx.db.delete(override._id);
          expiredOverrides++;
          deletedAny = true;
        }
      }
      if (overrides.length < BATCH_SIZE || !deletedAny) break;
    }

    // 2. Indexed tables: effectiveRoles, effectivePermissions
    while (true) {
      const effectiveRoles = args.tenantId
        ? await ctx.db
            .query("effectiveRoles")
            .withIndex("by_tenant_user", (q) =>
              q.eq("tenantId", args.tenantId!),
            )
            .take(BATCH_SIZE)
        : await ctx.db
            .query("effectiveRoles")
            .order("asc")
            .take(BATCH_SIZE);
      if (effectiveRoles.length === 0) break;
      let deletedAny = false;
      for (const row of effectiveRoles) {
        if (row.expiresAt && row.expiresAt < now) {
          await ctx.db.delete(row._id);
          expiredEffectiveRoles++;
          deletedAny = true;
        }
      }
      if (effectiveRoles.length < BATCH_SIZE || !deletedAny) break;
    }

    while (true) {
      const effectivePermissions = args.tenantId
        ? await ctx.db
            .query("effectivePermissions")
            .withIndex("by_tenant_user", (q) =>
              q.eq("tenantId", args.tenantId!),
            )
            .take(BATCH_SIZE)
        : await ctx.db
            .query("effectivePermissions")
            .order("asc")
            .take(BATCH_SIZE);
      if (effectivePermissions.length === 0) break;
      let deletedAny = false;
      for (const row of effectivePermissions) {
        if (row.expiresAt && row.expiresAt < now) {
          await ctx.db.delete(row._id);
          expiredEffectivePermissions++;
          deletedAny = true;
        }
      }
      if (effectivePermissions.length < BATCH_SIZE || !deletedAny) break;
    }

    return {
      expiredRoleAssignments,
      expiredOverrides,
      expiredEffectiveRoles,
      expiredEffectivePermissions,
    };
  },
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getOptionalEnvNumber(name: string): number | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    const proc = g["process"] as
      | { env: Record<string, string | undefined> }
      | undefined;
    const env = proc?.env;
    const raw = env && (env[name] as string | undefined);
    if (raw === undefined || raw === "") return undefined;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Audit log retention cleanup: deletes entries by max age and/or caps total entries.
 * Config from args (when provided) or env AUDIT_RETENTION_DAYS and AUDIT_RETENTION_MAX_ENTRIES.
 * Omit or 0 = skip that policy. Intended to be run daily via cron (e.g. authz-audit-retention).
 */
export const runAuditRetentionCleanup = mutation({
  args: v.object({
    tenantId: v.optional(v.string()),
    maxAgeDays: v.optional(v.number()),
    maxEntries: v.optional(v.number()),
  }),
  returns: v.object({
    deletedByAge: v.number(),
    deletedByCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const maxAgeDays: number | undefined =
      args.maxAgeDays ?? getOptionalEnvNumber("AUDIT_RETENTION_DAYS");
    const maxEntries: number | undefined =
      args.maxEntries ?? getOptionalEnvNumber("AUDIT_RETENTION_MAX_ENTRIES");

    let deletedByAge = 0;
    let deletedByCount = 0;

    if (maxAgeDays !== undefined && maxAgeDays > 0) {
      const cutoff = Date.now() - maxAgeDays * MS_PER_DAY;
      if (args.tenantId) {
        while (true) {
          const batch = await ctx.db
            .query("auditLog")
            .withIndex("by_tenant_timestamp", (q) =>
              q.eq("tenantId", args.tenantId!).lt("timestamp", cutoff),
            )
            .order("asc")
            .take(BATCH_SIZE);
          if (batch.length === 0) break;
          for (const doc of batch) {
            await ctx.db.delete(doc._id);
            deletedByAge++;
          }
        }
      } else {
        // Global path: scan oldest rows in batches, filter expired in memory
        while (true) {
          const batch = await ctx.db
            .query("auditLog")
            .order("asc")
            .take(BATCH_SIZE);
          if (batch.length === 0) break;
          let deletedAny = false;
          for (const doc of batch) {
            if (doc.timestamp < cutoff) {
              await ctx.db.delete(doc._id);
              deletedByAge++;
              deletedAny = true;
            }
          }
          if (batch.length < BATCH_SIZE || !deletedAny) break;
        }
      }
    }

    if (maxEntries !== undefined && maxEntries > 0) {
      if (args.tenantId) {
        // Tenant-scoped: find the newest maxEntries entries to keep,
        // then delete everything older in batches
        const keepEntries = await ctx.db
          .query("auditLog")
          .withIndex("by_tenant_timestamp", (q) =>
            q.eq("tenantId", args.tenantId!),
          )
          .order("desc")
          .take(maxEntries);
        if (keepEntries.length === maxEntries) {
          // There may be excess entries; delete anything not in the keep set
          const keepIds = new Set(
            keepEntries.map((e) => e._id.toString()),
          );
          while (true) {
            const batch = await ctx.db
              .query("auditLog")
              .withIndex("by_tenant_timestamp", (q) =>
                q.eq("tenantId", args.tenantId!),
              )
              .order("asc")
              .take(BATCH_SIZE);
            if (batch.length === 0) break;
            let deletedAny = false;
            for (const doc of batch) {
              if (!keepIds.has(doc._id.toString())) {
                await ctx.db.delete(doc._id);
                deletedByCount++;
                deletedAny = true;
              }
            }
            if (batch.length < BATCH_SIZE || !deletedAny) break;
          }
        }
      } else {
        // Global path: find the newest maxEntries entries to keep,
        // then delete everything older in batches
        const keepEntries = await ctx.db
          .query("auditLog")
          .order("desc")
          .take(maxEntries);
        if (keepEntries.length === maxEntries) {
          // There may be excess entries; delete anything not in the keep set
          const keepIds = new Set(
            keepEntries.map((e) => e._id.toString()),
          );
          while (true) {
            const batch = await ctx.db
              .query("auditLog")
              .order("asc")
              .take(BATCH_SIZE);
            if (batch.length === 0) break;
            let deletedAny = false;
            for (const doc of batch) {
              if (!keepIds.has(doc._id.toString())) {
                await ctx.db.delete(doc._id);
                deletedByCount++;
                deletedAny = true;
              }
            }
            if (batch.length < BATCH_SIZE || !deletedAny) break;
          }
        }
      }
    }

    return { deletedByAge, deletedByCount };
  },
});
