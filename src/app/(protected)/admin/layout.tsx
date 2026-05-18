import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { requireAdminRole } from "@/lib/admin/auth";
import { AdminControlCenterLayout } from "@/components/admin/layout/AdminControlCenterLayout";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let adminContext;

  try {
    adminContext = await requireAdminRole();
  } catch {
    redirect("/dashboard?error=unauthorized");
  }

  const superUser = adminContext.role === "SUPER_ADMIN";

  return (
    <AdminControlCenterLayout superUser={superUser}>
      {children}
    </AdminControlCenterLayout>
  );
}
