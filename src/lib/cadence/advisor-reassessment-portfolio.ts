import "server-only";

import { prisma } from "@/lib/db";
import { getCadenceForClient } from "@/lib/cadence/review-cadence";
import type { CadenceInfo } from "@/lib/cadence/cadence-types";
import { getTargetedQuestionCount } from "@/lib/assessment/targeted-followup";
import { formatPipelineClientRowTitle } from "@/lib/pipeline/client-display";
import { safeDecryptUserEmail } from "@/lib/auth/user-email";

export type ReassessmentCadenceClientRow = {
  clientId: string;
  clientName: string;
  assessmentId: string;
  assessmentCompletedAt: Date | null;
  cadence: CadenceInfo | null;
  targetedQuestionCount: number;
  pipelineHref: string;
};

const CADENCE_PRIORITY: Record<CadenceInfo["status"], number> = {
  overdue: 0,
  system_recommended: 1,
  due_soon: 2,
  on_track: 3,
};

export async function listReassessmentCadenceClients(
  advisorProfileId: string,
): Promise<ReassessmentCadenceClientRow[]> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    select: {
      clientId: true,
      client: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          emailCiphertext: true,
        },
      },
    },
  });

  const rows: ReassessmentCadenceClientRow[] = [];

  for (const assignment of assignments) {
    const latestAssessment = await prisma.assessment.findFirst({
      where: { userId: assignment.clientId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { id: true, completedAt: true },
    });
    if (!latestAssessment) continue;

    const cadence = await getCadenceForClient(assignment.clientId, advisorProfileId);
    const targetedQuestionCount = await getTargetedQuestionCount(latestAssessment.id);
    const clientName = formatPipelineClientRowTitle({
      name: assignment.client.name,
      firstName: assignment.client.firstName,
      lastName: assignment.client.lastName,
      email: safeDecryptUserEmail(assignment.client.emailCiphertext, {
        rowId: assignment.client.id,
      }),
    });

    rows.push({
      clientId: assignment.clientId,
      clientName,
      assessmentId: latestAssessment.id,
      assessmentCompletedAt: latestAssessment.completedAt,
      cadence,
      targetedQuestionCount,
      pipelineHref: `/advisor/pipeline/${assignment.clientId}`,
    });
  }

  return rows.sort((a, b) => {
    const aPriority = a.cadence ? CADENCE_PRIORITY[a.cadence.status] : 4;
    const bPriority = b.cadence ? CADENCE_PRIORITY[b.cadence.status] : 4;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aDue = a.cadence?.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.cadence?.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}
