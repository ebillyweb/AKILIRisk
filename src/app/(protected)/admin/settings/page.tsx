import Link from "next/link";
import { auth } from "@/lib/auth";
import { isSuperAdmin, requireAdminRole } from "@/lib/admin/auth";
import { getPlatformAdvisorFeatureFlagsForAdmin, getPasswordPolicyForSuperAdmin } from "@/lib/admin/platform-settings-actions";
import { AdminAdvisorFeatureFlagsForm } from "@/components/admin/AdminAdvisorFeatureFlagsForm";
import { AdminPasswordPolicyForm } from "@/components/admin/AdminPasswordPolicyForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminSettingsPage() {
  await requireAdminRole();

  const session = await auth();
  const superAdmin = isSuperAdmin(session);

  const flagsRes = superAdmin
    ? await getPlatformAdvisorFeatureFlagsForAdmin()
    : null;
  const passwordPolicyRes = superAdmin ? await getPasswordPolicyForSuperAdmin() : null;

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

      <Card data-tour="config-password-policy">
        <CardHeader>
          <CardTitle className="text-base">Password policy</CardTitle>
          <CardDescription>
            Rules for advisor and admin credentials. When requirements change, affected
            staff are prompted to update their password before accessing the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!superAdmin ? (
            <p className="text-sm text-muted-foreground">
              Only super admins can view or change the platform password policy.
            </p>
          ) : passwordPolicyRes ? (
            <AdminPasswordPolicyForm initialPolicy={passwordPolicyRes} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Multi-factor authentication</CardTitle>
          <CardDescription>
            MFA is optional for all account types. Users who enable MFA must
            complete a verification challenge each session; others sign in with
            their usual method only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            There is no platform-wide MFA requirement. Advisors, admins, and
            clients can enable two-factor authentication from{" "}
            <span className="font-medium text-foreground">Settings</span> when
            they choose to.
          </p>
        </CardContent>
      </Card>

      <Card data-tour="config-feature-flags">
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
              initialWorkflowTasks={flagsRes.data.advisorWorkflowTasksEnabled}
              initialWorkflowFollowUps={flagsRes.data.advisorWorkflowFollowUpsEnabled}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
