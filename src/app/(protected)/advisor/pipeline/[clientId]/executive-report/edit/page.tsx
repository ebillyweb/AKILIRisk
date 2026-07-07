import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/db";
import { generateExecutiveReport } from "@/lib/actions/executive-report-actions";
import { getExecutiveDraftData } from "@/lib/reports/executive-report-queries";
import { ExecutiveReportDraftForm } from "@/components/reports/ExecutiveReportDraftForm";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

/**
 * Phase 25: Advisor edit-draft page for executive reports.
 *
 * Server component shell. Resolves the active DRAFT (creating one via
 * generateExecutiveReport when none exists — idempotent) and hands form
 * props to the client component.
 *
 * Auth: ACTIVE assignment + isAdvisorHubNavRole (mirrors report/edit/page.tsx).
 */
export default async function AdvisorExecutiveReportEditPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      buildSignInHref({
        callbackUrl: `/advisor/pipeline/${clientId}/executive-report/edit`,
      })
    );
  }
  if (!isAdvisorHubNavRole(session.user.role)) {
    notFound();
  }

  if (session.user.role === "ADVISOR") {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!advisor) notFound();
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { advisorId: advisor.id, clientId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!assignment) notFound();
  }

  // Require at least one COMPLETED assessment.
  const latestCompleted = await prisma.assessment.findFirst({
    where: { userId: clientId, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (!latestCompleted) {
    return (
      <div className="container mx-auto py-6">
        <Link
          href={`/advisor/pipeline/${clientId}/executive-report`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to executive reports
        </Link>
        <p className="text-muted-foreground">
          Complete an assessment before generating an executive report.
        </p>
      </div>
    );
  }

  // Ensure a DRAFT exists (idempotent — returns existing draft if present).
  const ensure = await generateExecutiveReport({ clientId });
  if (!ensure.ok) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-destructive">{ensure.message}</p>
      </div>
    );
  }

  const draftData = await getExecutiveDraftData(ensure.data.reportId);
  if (!draftData) {
    // Unreachable given generateExecutiveReport just succeeded, but
    // belt-and-suspenders for concurrent publish race.
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">No draft available — refresh.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link
          href={`/advisor/pipeline/${clientId}/executive-report`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to executive reports
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Executive Report Draft</h1>
        <p className="mt-2 text-muted-foreground">
          Add advisor notes, meeting agenda, and discussion prompts. Publish freezes the
          snapshot and supersedes any prior published executive report.
        </p>
      </div>

      <ExecutiveReportDraftForm draft={draftData} clientId={clientId} />
    </div>
  );
}
