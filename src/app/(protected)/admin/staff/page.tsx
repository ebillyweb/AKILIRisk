import Link from "next/link";
import { auth } from "@/lib/auth";
import { isSuperAdmin, requireAdminRole } from "@/lib/admin/auth";
import { getPlatformStaffForAdmin } from "@/lib/admin/queries";
import { AdminPlatformStaffTable } from "@/components/admin/AdminPlatformStaffTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";

export default async function AdminStaffPage() {
  await requireAdminRole();
  const session = await auth();
  const superUser = isSuperAdmin(session);
  const staff = await getPlatformStaffForAdmin();

  return (
    <div className="space-y-6">
      {superUser && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Staff Management</h1>
            <p className="text-muted-foreground">Manage platform administrators and staff accounts.</p>
          </div>
          <Button asChild>
            <Link href="/admin/staff/admin-users">
              <UserPlus className="size-4 mr-2" />
              Manage Admin Users
            </Link>
          </Button>
        </div>
      )}

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

      {superUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin User Provisioning</CardTitle>
            <CardDescription>
              As a super admin, you can create dedicated administrator accounts separate from advisors and clients.
              These accounts have platform administration privileges and can manage users, assessments, and configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/admin/staff/admin-users">
                <UserPlus className="size-4 mr-2" />
                Create and Manage Admin Users
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
