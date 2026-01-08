import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Building2, FileText, Shield } from "lucide-react";

export function DashboardPage() {
  const stats = useQuery(api.app.getStats);
  const roleDefinitions = useQuery(api.app.getRoleDefinitions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your authorization setup
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users ?? "—"}</div>
            <p className="text-xs text-muted-foreground">
              Active users in the system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.orgs ?? "—"}</div>
            <p className="text-xs text-muted-foreground">
              Tenant organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.documents ?? "—"}</div>
            <p className="text-xs text-muted-foreground">
              Protected resources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Role Assignments
            </CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.roleAssignments ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Active role grants
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role Definitions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Definitions</CardTitle>
          <CardDescription>
            Roles defined in code and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {roleDefinitions?.map((role) => (
              <div
                key={role.name}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{role.label}</h3>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                    {role.name}
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  {role.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {role.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Get started with the demo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">1. Seed Demo Data</h4>
            <code className="text-sm bg-background px-3 py-1.5 rounded block">
              npx convex run seed:seedAll
            </code>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">2. Try Permission Tester</h4>
            <p className="text-sm text-muted-foreground">
              Use the sidebar to navigate to the Permission Tester and see
              authorization in action.
            </p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">3. Clear Data</h4>
            <code className="text-sm bg-background px-3 py-1.5 rounded block">
              npx convex run seed:clearAll
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
