import { Suspense } from "react";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";
import { requireSuperAdminRole } from "@/lib/admin/auth";

export default async function AdminUserManagementPage() {
  // Ensure only super admins can access this page
  await requireSuperAdminRole();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Admin User Management
        </h1>
        <p className="text-lg text-muted-foreground">
          Create and manage platform administrator accounts.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-[400px] bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-[300px] bg-muted/30 rounded-lg animate-pulse" />
          </div>
        }
      >
        <AdminUserManagement />
      </Suspense>
    </div>
  );
}