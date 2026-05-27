import { redirect } from "next/navigation";
import { requireSuperAdminRole } from "@/lib/admin/auth";

/** Legacy route — platform staff role UI removed; use Admin User Management. */
export default async function AdminStaffPage() {
  await requireSuperAdminRole();
  redirect("/admin/staff/admin-users");
}
