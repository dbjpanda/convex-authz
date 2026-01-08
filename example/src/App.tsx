import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPage } from "@/pages/dashboard";
import { UsersPage } from "@/pages/users";
import { PermissionTesterPage } from "@/pages/permission-tester";

type Page = "dashboard" | "users" | "permission-tester";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "users":
        return <UsersPage />;
      case "permission-tester":
        return <PermissionTesterPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        currentPage={currentPage}
        onPageChange={(page) => setCurrentPage(page as Page)}
      />
      <main className="flex-1 p-6 overflow-auto">{renderPage()}</main>
    </div>
  );
}

export default App;
