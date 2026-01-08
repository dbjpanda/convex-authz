import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { Users, Plus, Trash2, Building2 } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";

export function UsersPage() {
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(
    null
  );
  const [selectedOrgId, setSelectedOrgId] = useState<Id<"orgs"> | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const users = useQuery(api.app.listUsers) ?? [];
  const orgs = useQuery(api.app.listOrgs) ?? [];
  const roleDefinitions = useQuery(api.app.getRoleDefinitions) ?? [];

  const userWithRoles = useQuery(
    api.app.getUserWithRoles,
    selectedUserId ? { userId: selectedUserId } : "skip"
  );

  const assignRole = useMutation(api.app.assignRole);
  const revokeRole = useMutation(api.app.revokeRole);

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRole) return;
    await assignRole({
      userId: selectedUserId,
      role: selectedRole,
      orgId: selectedOrgId ?? undefined,
    });
    setSelectedRole(null);
  };

  const handleRevokeRole = async (role: string, orgId?: string) => {
    if (!selectedUserId) return;
    await revokeRole({
      userId: selectedUserId,
      role,
      orgId: orgId ? (orgId as Id<"orgs">) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="size-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground">
            Manage user role assignments
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
            <CardDescription>Select a user to manage roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No users. Seed data first.
                </p>
              ) : (
                users.map((user) => (
                  <Button
                    key={user._id}
                    variant={selectedUserId === user._id ? "default" : "ghost"}
                    onClick={() => setSelectedUserId(user._id)}
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

        {/* User Details & Role Management */}
        <Card className="lg:col-span-2">
          {selectedUserId && userWithRoles ? (
            <>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                    {userWithRoles.user.avatar ||
                      userWithRoles.user.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle>{userWithRoles.user.name}</CardTitle>
                    <CardDescription>
                      {userWithRoles.user.email}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Roles */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Current Roles</h4>
                  {userWithRoles.roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No roles assigned
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {userWithRoles.roles.map((role) => (
                        <div
                          key={role._id}
                          className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5"
                        >
                          <Badge variant="outline">{role.role}</Badge>
                          {role.scope && (
                            <span className="text-xs text-muted-foreground">
                              @ {role.scope.type}:{role.scope.id.slice(-8)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() =>
                              handleRevokeRole(role.role, role.scope?.id)
                            }
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assign New Role */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium mb-3">Assign New Role</h4>
                  <div className="space-y-4">
                    {/* Role Selection */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">
                        Select Role
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {roleDefinitions.map((role) => (
                          <Button
                            key={role.name}
                            variant={
                              selectedRole === role.name
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => setSelectedRole(role.name)}
                          >
                            {role.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Org Scope Selection */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">
                        Scope (Optional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={
                            selectedOrgId === null ? "secondary" : "outline"
                          }
                          size="sm"
                          onClick={() => setSelectedOrgId(null)}
                        >
                          Global
                        </Button>
                        {orgs.map((org) => (
                          <Button
                            key={org._id}
                            variant={
                              selectedOrgId === org._id ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setSelectedOrgId(org._id)}
                          >
                            <Building2 className="size-3 mr-1" />
                            {org.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Assign Button */}
                    <Button
                      onClick={handleAssignRole}
                      disabled={!selectedRole}
                      className="w-full"
                    >
                      <Plus className="size-4 mr-2" />
                      Assign {selectedRole || "Role"}
                      {selectedOrgId &&
                        ` to ${orgs.find((o) => o._id === selectedOrgId)?.name}`}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                Select a user to manage their roles
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
