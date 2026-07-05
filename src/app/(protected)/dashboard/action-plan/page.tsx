import { auth } from "@/lib/auth";
import { isPlatformAdminRole, normalizeUserRoleString } from "@/lib/auth-roles";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isClientActionPlanEnabledForUser } from "@/lib/client/client-action-plan-visibility.server";
import { getClientActionPlan, getActionPlanTrackingContext } from "@/lib/actions/client-action-plan-actions";
import { StrategicActionPlan } from "@/components/action-plan/StrategicActionPlan";

export default async function ActionPlanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  // Role-based redirect
  const role = normalizeUserRoleString(session.user.role);
  if (role === "ADVISOR") {
    redirect("/advisor");
  }
  if (isPlatformAdminRole(role)) {
    redirect("/admin");
  }

  const actionPlanEnabled = await isClientActionPlanEnabledForUser(session.user.id);
  if (!actionPlanEnabled) {
    redirect("/dashboard");
  }

  const [result, trackingContext] = await Promise.all([
    getClientActionPlan(),
    getActionPlanTrackingContext(),
  ]);

  // Error state
  if (!result.success) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold font-display tracking-[-0.03em] text-foreground">
          Your Strategic Action Plan
        </h1>
        <div className="mt-6">
          <Alert variant="destructive">
            <AlertDescription>
              Unable to load your action plan. Please try refreshing. If this
              continues, contact your advisor.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const data = result.data;

  // Empty state -- no items in any horizon
  const totalItems =
    data.immediate.length + data.strategic.length + data.ongoing.length;

  if (totalItems === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold font-display tracking-[-0.03em] text-foreground">
          Your Strategic Action Plan
        </h1>
        <div className="mt-8 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Your action plan is being prepared
          </p>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Your advisor is reviewing your assessment results and will publish
            your Strategic Action Plan shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold font-display tracking-[-0.03em] text-foreground">
        Your Strategic Action Plan
      </h1>
      <div className="mt-6">
        <StrategicActionPlan data={data} trackingContext={trackingContext} />
      </div>
    </div>
  );
}
