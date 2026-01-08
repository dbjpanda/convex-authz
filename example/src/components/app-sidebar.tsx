import {
  LayoutDashboard,
  Users,
  TestTube,
  Shield,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  page: string;
}

const navItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { title: "Users & Roles", icon: Users, page: "users" },
  { title: "Permission Tester", icon: TestTube, page: "permission-tester" },
];

interface AppSidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export function AppSidebar({ currentPage, onPageChange }: AppSidebarProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    document.documentElement.classList.toggle("dark", newValue);
  };

  return (
    <aside className="w-64 border-r bg-sidebar h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-primary" />
          <div>
            <h1 className="font-bold text-lg">convex-authz</h1>
            <p className="text-xs text-muted-foreground">@djpanda</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.page}
            variant={currentPage === item.page ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3",
              currentPage === item.page && "bg-sidebar-accent"
            )}
            onClick={() => onPageChange(item.page)}
          >
            <item.icon className="size-4" />
            {item.title}
          </Button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-3">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={toggleTheme}
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </Button>

        {/* Links */}
        <div className="text-xs text-muted-foreground space-y-1 px-3">
          <a
            href="https://github.com/dbjpanda/convex-authz"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-foreground transition-colors"
          >
            GitHub →
          </a>
          <a
            href="https://www.npmjs.com/package/@djpanda/convex-authz"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-foreground transition-colors"
          >
            npm →
          </a>
        </div>
      </div>
    </aside>
  );
}
