import { auth } from "@/lib/auth";
import { isSuperAdmin, requireAdminRole } from "@/lib/admin/auth";
import { getPlatformStaffForAdmin } from "@/lib/admin/queries";
import { AdminPlatformStaffTable } from "@/components/admin/AdminPlatformStaffTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminStaffPage() {
  await requireAdminRole();
  const session = await auth();
  const superUser = isSuperAdmin(session);
  const staff = await getPlatformStaffForAdmin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform staff</CardTitle>
          <CardDescription>
            Accounts with the ADMIN or SUPER_ADMIN role. All platform admins can view this list; only super
            admins can change roles, promote a client to admin, demote staff to client, or deactivate staff.
            The last active super admin cannot be demoted or deactivated until another super admin exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminPlatformStaffTable staff={staff} canMutate={superUser} />
        </CardContent>
      </Card>
    </div>
  );
}
