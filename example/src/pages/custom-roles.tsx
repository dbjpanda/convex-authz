import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
import {
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";

interface CustomRoleDoc {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export function CustomRolesPage() {
  const users = useQuery(api.app.listUsers) ?? [];
  const customRoles = (useQuery(api.app.listCustomRoles) ?? []) as CustomRoleDoc[];
  const grantable =
    (useQuery(api.app.getCustomRoleGrantablePermissions) ?? []) as string[];

  const createCustomRole = useMutation(api.app.createCustomRole);
  const deleteCustomRole = useMutation(api.app.deleteCustomRole);
  const updateCustomRole = useAction(api.app.updateCustomRole);
  const assignCustomRole = useMutation(api.app.assignCustomRole);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPermissions, setNewPermissions] = useState<Set<string>>(new Set());
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);
  const [lastUpdateResult, setLastUpdateResult] = useState<{
    permissionsChanged: boolean;
    usersRecomputed: number;
  } | null>(null);

  const [assignUserId, setAssignUserId] = useState<Id<"users"> | "">("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const togglePerm = (set: Set<string>, perm: string): Set<string> => {
    const next = new Set(set);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    return next;
  };

  const selectedRole = customRoles.find((r) => r._id === selectedRoleId);

  const handleCreate = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (newPermissions.size === 0) {
      setCreateError("Pick at least one permission");
      return;
    }
    if (users.length === 0) {
      setCreateError("Seed users first (Dashboard → Seed Demo Data)");
      return;
    }
    try {
      setCreating(true);
      await createCustomRole({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        permissions: [...newPermissions],
        createdBy: users[0]._id,
      });
      setNewName("");
      setNewDescription("");
      setNewPermissions(new Set());
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectForEdit = (role: CustomRoleDoc) => {
    setSelectedRoleId(role._id);
    setEditPermissions(new Set(role.permissions));
    setLastUpdateResult(null);
  };

  const handleApplyUpdate = async () => {
    if (!selectedRole) return;
    try {
      setUpdating(true);
      const result = await updateCustomRole({
        customRoleId: selectedRole._id,
        permissions: [...editPermissions],
      });
      setLastUpdateResult(result);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async () => {
    setAssignError(null);
    if (!selectedRole || !assignUserId) {
      setAssignError("Pick a user");
      return;
    }
    try {
      await assignCustomRole({
        userId: assignUserId,
        customRoleId: selectedRole._id,
      });
    } catch (err) {
      setAssignError((err as Error).message);
    }
  };

  const handleDelete = async (roleId: string, force: boolean) => {
    try {
      await deleteCustomRole({ customRoleId: roleId, force });
      if (selectedRoleId === roleId) {
        setSelectedRoleId(null);
        setEditPermissions(new Set());
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6" data-testid="custom-roles-page">
      <div className="flex items-center gap-2">
        <Sparkles className="size-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Custom Roles</h1>
          <p className="text-muted-foreground">
            Tenant admins compose roles at runtime from a fixed permission whitelist
          </p>
        </div>
      </div>

      {/* Whitelist banner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grantable permissions</CardTitle>
          <CardDescription>
            The SaaS provider defines this whitelist. Tenant admins can compose
            roles from these but cannot invent new permission strings.
            <code className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">
              documents:delete
            </code>{" "}
            is intentionally excluded — try to assign it and watch it get
            rejected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" data-testid="grantable-list">
            {grantable.map((p) => (
              <Badge key={p} variant="secondary">
                {p}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create new */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a custom role</CardTitle>
            <CardDescription>
              Compose a role from the whitelist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                placeholder="e.g. Senior Editor"
                value={newName}
                data-testid="new-role-name"
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Description (optional)
              </label>
              <input
                type="text"
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                placeholder="e.g. Can edit but not delete"
                value={newDescription}
                data-testid="new-role-description"
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Permissions ({newPermissions.size})
              </label>
              <div className="flex flex-wrap gap-2">
                {grantable.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={newPermissions.has(p) ? "default" : "outline"}
                    onClick={() =>
                      setNewPermissions((set) => togglePerm(set, p))
                    }
                    data-testid={`new-perm-${p}`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            {createError && (
              <div
                className="text-sm text-destructive flex items-center gap-2"
                data-testid="create-error"
              >
                <AlertTriangle className="size-4" />
                {createError}
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={creating}
              data-testid="create-role-button"
            >
              <Plus className="size-4 mr-2" />
              {creating ? "Creating..." : "Create role"}
            </Button>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Roles defined for this tenant ({customRoles.length})
            </CardTitle>
            <CardDescription>
              Pick one to edit or assign. Update propagates to all assigned
              users via the cascade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customRoles.length === 0 ? (
              <p
                className="text-sm text-muted-foreground py-4 text-center"
                data-testid="empty-roles"
              >
                No custom roles yet. Create one →
              </p>
            ) : (
              <div className="space-y-2" data-testid="roles-list">
                {customRoles.map((role) => (
                  <div
                    key={role._id}
                    className={
                      "border rounded-lg p-3 cursor-pointer transition " +
                      (selectedRoleId === role._id
                        ? "border-primary bg-accent"
                        : "hover:bg-accent/50")
                    }
                    onClick={() => handleSelectForEdit(role)}
                    data-testid={`role-row-${role.name}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground">
                            {role.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {role.permissions.map((p) => (
                            <Badge
                              key={p}
                              variant="outline"
                              className="text-xs"
                            >
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(role._id, true);
                          }}
                          data-testid={`delete-role-${role.name}`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit selected role */}
      {selectedRole && (
        <Card data-testid="edit-card">
          <CardHeader>
            <CardTitle className="text-base">
              Edit "{selectedRole.name}"
            </CardTitle>
            <CardDescription>
              Toggle permissions and click "Apply update" — every user holding
              this role is recomputed via{" "}
              <code className="text-xs">recomputeUser</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Permissions ({editPermissions.size})
              </label>
              <div className="flex flex-wrap gap-2">
                {grantable.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={editPermissions.has(p) ? "default" : "outline"}
                    onClick={() =>
                      setEditPermissions((set) => togglePerm(set, p))
                    }
                    data-testid={`edit-perm-${p}`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleApplyUpdate}
                disabled={updating}
                data-testid="apply-update-button"
              >
                <RefreshCw className="size-4 mr-2" />
                {updating ? "Cascading..." : "Apply update"}
              </Button>
              {lastUpdateResult && (
                <div
                  className="flex items-center text-sm text-muted-foreground"
                  data-testid="update-result"
                >
                  {lastUpdateResult.permissionsChanged
                    ? `✓ ${lastUpdateResult.usersRecomputed} user(s) recomputed`
                    : "✓ No-op (set unchanged)"}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <label className="text-xs text-muted-foreground mb-2 block">
                Assign this role to a user
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded border bg-background px-3 py-2 text-sm"
                  value={assignUserId}
                  onChange={(e) =>
                    setAssignUserId(e.target.value as Id<"users"> | "")
                  }
                  data-testid="assign-user-select"
                >
                  <option value="">— pick user —</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <Button onClick={handleAssign} data-testid="assign-button">
                  <UserPlus className="size-4 mr-2" />
                  Assign
                </Button>
              </div>
              {assignError && (
                <div className="text-sm text-destructive mt-2">
                  {assignError}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
