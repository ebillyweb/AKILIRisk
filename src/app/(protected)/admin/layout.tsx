import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { isAdmin } from "@/lib/admin/auth";
import { AdminPageHeaderFromPath } from "@/components/layout/AdminPageHeader";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !isAdmin(session)) {
    redirect("/dashboard?error=unauthorized");
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeaderFromPath />
      {children}
    </div>
  );
}
