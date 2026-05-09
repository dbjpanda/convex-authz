import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useCanUser, PermissionGate } from "@djpanda/convex-authz/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Shield,
  User,
  Building2,
  Plus,
  Ban,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

const PERMISSIONS = [
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
] as const;

export function PermissionTesterPage() {
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(
    null
  );
  const [selectedOrgId, setSelectedOrgId] = useState<Id<"orgs"> | null>(null);

  const users = useQuery(api.app.listUsers) ?? [];
  const orgs = useQuery(api.app.listOrgs) ?? [];

  const userWithRoles = useQuery(
    api.app.getUserWithRoles,
    selectedUserId ? { userId: selectedUserId } : "skip"
  );

  const scope = selectedOrgId
    ? { type: "org" as const, id: String(selectedOrgId) }
    : undefined;
  const { allowed: canReadDocuments, isLoading: canReadLoading } = useCanUser(
    "documents:read",
    {
      userId: selectedUserId ? String(selectedUserId) : undefined,
      scope,
    }
  );

  const permissions = useQuery(
    api.app.checkAllPermissions,
    selectedUserId
      ? { userId: selectedUserId, orgId: selectedOrgId ?? undefined }
      : "skip"
  );

  const grantedCount = permissions
    ? Object.values(permissions).filter(Boolean).length
    : 0;
  const deniedCount = permissions
    ? Object.values(permissions).filter((v) => !v).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="size-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Permission Tester
          </h1>
          <p className="text-muted-foreground">
            Test which permissions a user has in different contexts
          </p>
        </div>
      </div>

      {/* Selection Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Select User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4" />
              Select User
            </CardTitle>
            <CardDescription>
              Choose a user to check their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No users. Run{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                    npx convex run seed:seedAll
                  </code>
                </p>
              ) : (
                users.map((user) => (
                  <Button
                    key={user._id}
                    variant={selectedUserId === user._id ? "default" : "outline"}
                    onClick={() =>
                      setSelectedUserId(
                        selectedUserId === user._id ? null : user._id
                      )
                    }
                    className="justify-start h-auto py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs opacity-70">{user.email}</div>
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Select Organization (Scope) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4" />
              Select Scope (Optional)
            </CardTitle>
            <CardDescription>
              Check permissions within a specific organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button
                variant={selectedOrgId === null ? "secondary" : "outline"}
                onClick={() => setSelectedOrgId(null)}
                className="justify-start"
              >
                <span className="text-muted-foreground">Global (no scope)</span>
              </Button>
              {orgs.map((org) => (
                <Button
                  key={org._id}
                  variant={selectedOrgId === org._id ? "default" : "outline"}
                  onClick={() =>
                    setSelectedOrgId(
                      selectedOrgId === org._id ? null : org._id
                    )
                  }
                  className="justify-start"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="size-4" />
                    <div className="text-left">
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs opacity-70">
                        {org.plan} plan
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick check via useCanUser hook */}
      {selectedUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hook: useCanUser</CardTitle>
            <CardDescription>
              documents:read for selected user
              {scope ? ` in ${orgs.find((o) => o._id === selectedOrgId)?.name}` : " (global)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            {canReadLoading ? (
              <span className="text-muted-foreground">Checking…</span>
            ) : canReadDocuments ? (
              <Badge variant="success">
                <CheckCircle2 className="size-3 mr-1" />
                Allowed
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="size-3 mr-1" />
                Denied
              </Badge>
            )}
            <PermissionGate
              permission="documents:update"
              userId={String(selectedUserId)}
              scope={scope}
              fallback={
                <Badge variant="outline">No edit access</Badge>
              }
              loadingFallback={
                <span className="text-muted-foreground text-sm">Checking…</span>
              }
            >
              <Badge variant="secondary">Can edit documents</Badge>
            </PermissionGate>
          </CardContent>
        </Card>
      )}

      {/* User Info */}
      {userWithRoles && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                {userWithRoles.user.avatar || userWithRoles.user.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold">{userWithRoles.user.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {userWithRoles.user.email}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                {userWithRoles.roles.length === 0 ? (
                  <Badge variant="outline">No roles</Badge>
                ) : (
                  userWithRoles.roles.map((role) => (
                    <Badge key={`${role.role}:${role.scopeKey}`} variant="secondary">
                      {role.role}
                      {role.scope && (
                        <span className="opacity-70 ml-1">
                          @{role.scope.type}
                        </span>
                      )}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Results */}
      {permissions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Permission Results</CardTitle>
                <CardDescription>
                  {selectedOrgId
                    ? `Checking permissions for ${orgs.find((o) => o._id === selectedOrgId)?.name}`
                    : "Checking global permissions"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="success">
                  <CheckCircle2 className="size-3 mr-1" />
                  {grantedCount} granted
                </Badge>
                <Badge variant="destructive">
                  <XCircle className="size-3 mr-1" />
                  {deniedCount} denied
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PERMISSIONS.map((perm) => {
                const allowed = permissions[perm];
                return (
                  <div
                    key={perm}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border",
                      allowed
                        ? "bg-green-500/5 border-green-500/30"
                        : "bg-destructive/5 border-destructive/30"
                    )}
                  >
                    {allowed ? (
                      <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="size-4 text-destructive" />
                    )}
                    <code className="text-sm">{perm}</code>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overrides panel — exercises grant / deny / removeOverride */}
      {selectedUserId && (
        <OverridesPanel
          userId={selectedUserId}
          orgId={selectedOrgId}
        />
      )}

      {/* Empty State */}
      {!selectedUserId && (
        <Card className="border-dashed">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Select a user above to test their permissions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface OverridesPanelProps {
  userId: Id<"users">;
  orgId: Id<"orgs"> | null;
}

/**
 * Demonstrates the override lifecycle: grant a permission directly, deny one
 * even if the user has it via role, and remove either kind of override. This
 * showcases the symmetric `removeOverride` API. The grid above this panel
 * uses Convex's reactive queries, so each click visibly flips the relevant
 * permission's allow/deny state in real time.
 */
function OverridesPanel({ userId, orgId }: OverridesPanelProps) {
  const [permission, setPermission] = useState<string>("documents:delete");
  const [lastAction, setLastAction] = useState<string | null>(null);

  const grant = useMutation(api.app.grantPermission);
  const deny = useMutation(api.app.denyPermission);
  const remove = useMutation(api.app.removeOverride);

  const orgArg = orgId ?? undefined;

  const handleGrant = async () => {
    await grant({ userId, permission, orgId: orgArg });
    setLastAction(`Granted ${permission}`);
  };
  const handleDeny = async () => {
    await deny({ userId, permission, orgId: orgArg });
    setLastAction(`Denied ${permission}`);
  };
  const handleRemove = async () => {
    const removed = await remove({ userId, permission, orgId: orgArg });
    setLastAction(
      removed
        ? `Override removed for ${permission}`
        : `No override existed for ${permission}`,
    );
  };

  return (
    <Card data-testid="overrides-panel">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Eraser className="size-4" />
          Permission Overrides
        </CardTitle>
        <CardDescription>
          Pick a permission, then try{" "}
          <code className="text-xs">grantPermission</code>,{" "}
          <code className="text-xs">denyPermission</code>, and{" "}
          <code className="text-xs">removeOverride</code>. Watch the row
          above react in real time.{" "}
          <strong>
            grant and deny are NOT inverses — they upsert the same row's
            effect; removeOverride is the only way to delete the row and
            restore role-derived access.
          </strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">
            Permission
          </label>
          <div className="flex flex-wrap gap-2">
            {PERMISSIONS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={permission === p ? "default" : "outline"}
                onClick={() => {
                  setPermission(p);
                  setLastAction(null);
                }}
                data-testid={`override-perm-${p}`}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGrant} data-testid="override-grant">
            <Plus className="size-4 mr-2" />
            Grant
          </Button>
          <Button onClick={handleDeny} variant="secondary" data-testid="override-deny">
            <Ban className="size-4 mr-2" />
            Deny
          </Button>
          <Button onClick={handleRemove} variant="outline" data-testid="override-remove">
            <Eraser className="size-4 mr-2" />
            Remove override
          </Button>
        </div>

        {lastAction && (
          <div
            className="text-sm text-muted-foreground"
            data-testid="override-last-action"
          >
            Last action: {lastAction}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
