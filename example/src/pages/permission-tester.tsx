import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Shield, User, Building2 } from "lucide-react";
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
                    <Badge key={role._id} variant="secondary">
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
