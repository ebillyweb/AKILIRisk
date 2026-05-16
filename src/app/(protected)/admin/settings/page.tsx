import Link from "next/link";
import { auth } from "@/lib/auth";
import { isSuperAdmin, requireAdminRole } from "@/lib/admin/auth";
import { getPlatformAdvisorFeatureFlagsForAdmin } from "@/lib/admin/platform-settings-actions";
import { AdminAdvisorFeatureFlagsForm } from "@/components/admin/AdminAdvisorFeatureFlagsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminSettingsPage() {
  await requireAdminRole();

  const session = await auth();
  const superAdmin = isSuperAdmin(session);

  const flagsRes = superAdmin
    ? await getPlatformAdvisorFeatureFlagsForAdmin()
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Your admin account uses the same profile and security settings as other users.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">Open app Settings</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advisor feature flags</CardTitle>
          <CardDescription>
            Control visibility of governance dashboard and risk intelligence for all advisors. Disabled routes redirect
            to <span className="font-medium text-foreground">Clients</span> (<code className="text-xs">/advisor</code>
            ).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!superAdmin ? (
            <p className="text-sm text-muted-foreground">
              Only <span className="font-medium text-foreground">super admins</span> can view or change platform-wide
              advisor feature flags. Ask a super admin to run{" "}
              <code className="text-xs">node scripts/set-super-admin-role.js</code> for your account if needed.
            </p>
          ) : !flagsRes?.success ? (
            <p className="text-sm text-destructive">{flagsRes?.error ?? "Failed to load flags."}</p>
          ) : (
            <AdminAdvisorFeatureFlagsForm
              initialGovernanceDashboard={flagsRes.data.advisorGovernanceDashboardEnabled}
              initialRiskIntelligence={flagsRes.data.advisorRiskIntelligenceEnabled}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
