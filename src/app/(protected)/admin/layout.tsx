import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { isAdmin, isSuperAdmin } from "@/lib/admin/auth";
import { AdminControlCenterLayout } from "@/components/admin/layout/AdminControlCenterLayout";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !isAdmin(session)) {
    redirect("/dashboard?error=unauthorized");
  }

  const superUser = isSuperAdmin(session);

  return (
    <AdminControlCenterLayout superUser={superUser}>
      {children}
    </AdminControlCenterLayout>
  );
}
