import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDraftWithRecommendations } from "@/lib/reports/queries";
import { getOrCreateDraft } from "@/lib/actions/report-actions";
import { EditDraftForm } from "@/components/reports/EditDraftForm";

/**
 * §4.5 commit 3 (BRD §4.5) — advisor edit-draft page. Server component
 * shell. Resolves the active DRAFT (creating one when none exists via
 * `getOrCreateDraft`) and hands the form props to the client component.
 *
 * Auth: ACTIVE assignment from the calling advisor to the client. Admin
 * bypasses (mirrors getOrCreateDraft's admin override).
 */
export default async function AdvisorEditDraftPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (session.user.role !== "ADVISOR" && session.user.role !== "ADMIN") {
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

  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: clientId },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!latestAssessment) {
    return (
      <div className="container mx-auto py-6">
        <Link
          href={`/advisor/pipeline/${clientId}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to client
        </Link>
        <p className="text-muted-foreground">
          This client has no assessment yet. Reports become editable once an
          assessment is started.
        </p>
      </div>
    );
  }

  // Ensure a DRAFT exists. Server action returns the existing draft id
  // when one is present (idempotent).
  const ensure = await getOrCreateDraft(latestAssessment.id);
  if (!ensure.ok) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-destructive">{ensure.message}</p>
      </div>
    );
  }

  const data = await getDraftWithRecommendations(clientId);
  if (!data) {
    // Should be unreachable given getOrCreateDraft just succeeded, but
    // belt-and-suspenders for race with a concurrent publish.
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
          href={`/advisor/pipeline/${clientId}/report`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to reports
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Draft</h1>
        <p className="mt-2 text-muted-foreground">
          Editorial overlay on the assessment&apos;s scored data. Edits are
          frozen into the published Report when you click Publish; the scored
          data itself is captured at the same moment as a snapshot.
        </p>
      </div>

      <EditDraftForm
        clientId={clientId}
        draft={{
          id: data.draft.id,
          version: data.draft.version,
          templateChoice: data.draft.templateChoice,
          executiveSummary: data.draft.executiveSummary,
        }}
        recommendations={data.recommendations}
      />
    </div>
  );
}
