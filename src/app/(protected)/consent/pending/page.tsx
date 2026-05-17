import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listAssignmentsAwaitingConsent } from "@/lib/advisor/pending-consent";
import { ConsentDecisionForm } from "@/components/consent/ConsentDecisionForm";

/**
 * Option D session 2.2 (BRD §5.1 amendment) — per-assignment consent
 * prompt. Reached via the /dashboard early gate when the client has
 * at least one ACTIVE assignment with null fieldVisibility.
 *
 * Idempotent revisit: when every flagged assignment has a non-null
 * fieldVisibility (the consent decisions have been recorded), the
 * helper returns [] and we redirect back to /dashboard.
 *
 * Auth: only clients (role USER) see this page. Advisors and admins
 * are redirected to their respective hubs — they shouldn't end up
 * here in normal flow, but defense-in-depth in case the dashboard
 * gate is bypassed somehow (e.g. direct-link).
 */
export default async function ConsentPendingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const role = session.user.role?.toString().toUpperCase();
  if (role === "ADVISOR") redirect("/advisor");
  if (role === "ADMIN") redirect("/admin");

  const assignments = await listAssignmentsAwaitingConsent(session.user.id);
  if (assignments.length === 0) {
    // Nothing to consent to → dashboard.
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">Consent preferences</h1>
        <p className="mt-2 text-muted-foreground">
          {assignments.length === 1
            ? "Before you continue to your dashboard, please confirm what optional details your advisor can see."
            : "Before you continue to your dashboard, please confirm what optional details each of your advisors can see."}
        </p>
      </div>

      <ConsentDecisionForm assignments={assignments} />
    </div>
  );
}
