import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { PipelineClient, PipelineMetrics, ClientWorkflowStage, ClientDetail, WorkflowEvent } from "./types";
import { computeClientStage, computeProgress, isStalled } from "./status";

/** Voice answers often omit `answeredAt` until later; typed answers set it. */
function whereIntakeResponseHasAnswer(interviewId: string): Prisma.IntakeResponseWhereInput {
  return {
    interviewId,
    OR: [
      { answeredAt: { not: null } },
      { audioUrl: { not: null } },
      {
        AND: [{ transcription: { not: null } }, { NOT: { transcription: { equals: "" } } }],
      },
    ],
  };
}

/** Same predicate as `whereIntakeResponseHasAnswer` but keyed by a list of
 *  interview IDs. Used by the batched pipeline query so we issue one
 *  `groupBy` instead of one `count` per client. */
function whereIntakeResponsesForInterviewsHaveAnswer(
  interviewIds: string[]
): Prisma.IntakeResponseWhereInput {
  return {
    interviewId: { in: interviewIds },
    OR: [
      { answeredAt: { not: null } },
      { audioUrl: { not: null } },
      {
        AND: [{ transcription: { not: null } }, { NOT: { transcription: { equals: "" } } }],
      },
    ],
  };
}

/**
 * Fetches complete pipeline data for an advisor's clients
 */
export async function getClientPipeline(advisorProfileId: string): Promise<PipelineClient[]> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        include: {
          // Round-11 commit 2.1: clientProfile no longer carries
          // contact/address/DOB columns; the include was unused after
          // those drops, so remove it entirely.
          // Get latest intake interview
          intakeInterviews: {
            orderBy: {
              updatedAt: 'desc'
            },
            take: 1,
          },
          // Get latest completed assessment
          assessments: {
            where: {
              status: 'COMPLETED'
            },
            orderBy: {
              completedAt: 'desc'
            },
            take: 1,
            include: {
              scores: {
                orderBy: {
                  calculatedAt: 'desc'
                },
                take: 1,
              }
            }
          }
        }
      }
    }
  });

  // ── Batched lookups ──────────────────────────────────────────────────────
  // The previous shape ran 3 sequential queries per client inside the
  // `map(async ...)`. For an advisor with N clients that's 1 + 3N queries
  // per call. Worse, `/api/advisor/status-stream` polls this every 30s
  // while the pipeline tab is open, so a 50-client advisor was driving
  // ~5 queries/sec of baseline DB load just from one tab.
  //
  // Now: 4 queries total (assignments + 3 batches), independent of N.
  // The maps below let the per-client transform run synchronously.

  // De-dupe inputs. `clientEmail` filters nulls because Prisma's `in` would
  // include rows where prefillEmail equals null (which is not what `findFirst`
  // did with a string predicate); easier to exclude up front.
  const clientEmails = Array.from(
    new Set(
      assignments
        .map((a) => a.client.email)
        .filter((email): email is string => typeof email === 'string' && email.length > 0)
    )
  );
  const clientIds = Array.from(new Set(assignments.map((a) => a.client.id)));
  const latestIntakeIds = Array.from(
    new Set(
      assignments
        .map((a) => a.client.intakeInterviews[0]?.id)
        .filter((id): id is string => typeof id === 'string')
    )
  );

  // Fire all three independent batch queries in parallel.
  const [invitations, documentCounts, intakeResponseCounts] = await Promise.all([
    clientEmails.length > 0
      ? prisma.inviteCode.findMany({
          where: {
            createdBy: advisorProfileId,
            prefillEmail: { in: clientEmails },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    clientIds.length > 0
      ? prisma.documentRequirement.groupBy({
          by: ['clientId', 'fulfilled'],
          where: {
            advisorId: advisorProfileId,
            clientId: { in: clientIds },
          },
          _count: { fulfilled: true },
        })
      : Promise.resolve([]),
    latestIntakeIds.length > 0
      ? prisma.intakeResponse.groupBy({
          by: ['interviewId'],
          where: whereIntakeResponsesForInterviewsHaveAnswer(latestIntakeIds),
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  // Build per-key indexes so the per-client transform is a synchronous lookup.

  // Latest invitation per client email. The findMany is ordered desc, so the
  // FIRST occurrence per email is the one `findFirst` would have returned.
  // (Map.set with the same key would overwrite — we explicitly skip later
  // duplicates to preserve "latest wins".)
  type InvitationRow = (typeof invitations)[number];
  const invitationByEmail = new Map<string, InvitationRow>();
  for (const inv of invitations) {
    if (inv.prefillEmail && !invitationByEmail.has(inv.prefillEmail)) {
      invitationByEmail.set(inv.prefillEmail, inv);
    }
  }

  // Document requirement counts per client. groupBy returns one row per
  // (clientId, fulfilled) combination; we collapse to {required, fulfilled}.
  const documentCountsByClient = new Map<string, { required: number; fulfilled: number }>();
  for (const row of documentCounts) {
    const slot = documentCountsByClient.get(row.clientId) ?? { required: 0, fulfilled: 0 };
    if (row.fulfilled) {
      slot.fulfilled = row._count.fulfilled;
    } else {
      slot.required = row._count.fulfilled;
    }
    documentCountsByClient.set(row.clientId, slot);
  }

  // Intake response counts (only for interviews that have at least one
  // matching response — interviews with zero matches won't appear in the
  // groupBy result, and we treat absence as 0 below).
  const responseCountByInterview = new Map<string, number>();
  for (const row of intakeResponseCounts) {
    responseCountByInterview.set(row.interviewId, row._count._all);
  }

  // ── Per-client transform — synchronous now ──────────────────────────────
  const clients: PipelineClient[] = assignments.map((assignment) => {
    const client = assignment.client;

    const invitation = invitationByEmail.get(client.email) ?? null;
    const docCounts = documentCountsByClient.get(client.id) ?? { required: 0, fulfilled: 0 };
    const documentsRequired = docCounts.required;
    const documentsFulfilled = docCounts.fulfilled;

    // Get the most recent activity date
    const latestIntake = client.intakeInterviews[0];
    const latestAssessment = client.assessments[0];

    const activityDates = [
      assignment.assignedAt,
      invitation?.statusUpdatedAt,
      latestIntake?.updatedAt,
      latestAssessment?.updatedAt || latestAssessment?.completedAt,
    ].filter(Boolean) as Date[];

    const lastActivity = activityDates.length > 0
      ? new Date(Math.max(...activityDates.map(d => d.getTime())))
      : assignment.assignedAt;

    // Compute stage from all available data
    const intakeWaived = assignment.intakeWaivedAt != null;
    const intakeForStage =
      latestIntake != null
        ? {
            status: latestIntake.status,
            updatedAt: latestIntake.updatedAt,
            submittedAt: latestIntake.submittedAt,
            waived: intakeWaived,
          }
        : intakeWaived
          ? {
              status: "NOT_STARTED" as const,
              updatedAt: assignment.assignedAt,
              submittedAt: null as Date | null,
              waived: true as const,
            }
          : undefined;

    const stage = computeClientStage({
      invitation: invitation ? {
        status: invitation.status,
        statusUpdatedAt: invitation.statusUpdatedAt,
      } : undefined,
      intake: intakeForStage,
      assessment: latestAssessment ? {
        status: latestAssessment.status,
        completedAt: latestAssessment.completedAt,
        updatedAt: latestAssessment.updatedAt,
      } : undefined,
      documents: {
        required: documentsRequired,
        fulfilled: documentsFulfilled,
      }
    });

    const pipelineClient: PipelineClient = {
      id: client.id,
      name: client.name,
      email: client.email,
      assignedAt: assignment.assignedAt,
      stage,
      progress: computeProgress(stage),
      lastActivity,
      invitation: invitation ? {
        status: invitation.status,
        sentAt: invitation.createdAt,
        code: invitation.code,
      } : null,
      intake: latestIntake
        ? {
            status: latestIntake.status,
            responseCount: responseCountByInterview.get(latestIntake.id) ?? 0,
            submittedAt: latestIntake.submittedAt,
            waivedAt: assignment.intakeWaivedAt,
          }
        : intakeWaived
          ? {
              status: "NOT_STARTED",
              responseCount: 0,
              submittedAt: null,
              waivedAt: assignment.intakeWaivedAt,
            }
          : null,
      assessment: latestAssessment ? {
        status: latestAssessment.status,
        completedAt: latestAssessment.completedAt,
        score: latestAssessment.scores[0]?.score || null,
      } : null,
      documents: {
        required: documentsRequired,
        fulfilled: documentsFulfilled,
      }
    };

    return pipelineClient;
  });

  // Sort by lastActivity descending by default
  return clients.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

/**
 * Computes pipeline metrics from client data
 */
export function getPipelineMetrics(clients: PipelineClient[]): PipelineMetrics {
  const total = clients.length;

  // Count by stage
  const byStage = clients.reduce((acc, client) => {
    acc[client.stage] = (acc[client.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Ensure all stages are represented
  const allStages: Record<ClientWorkflowStage, number> = {
    INVITED: byStage.INVITED || 0,
    REGISTERED: byStage.REGISTERED || 0,
    INTAKE_IN_PROGRESS: byStage.INTAKE_IN_PROGRESS || 0,
    INTAKE_COMPLETE: byStage.INTAKE_COMPLETE || 0,
    ASSESSMENT_IN_PROGRESS: byStage.ASSESSMENT_IN_PROGRESS || 0,
    ASSESSMENT_COMPLETE: byStage.ASSESSMENT_COMPLETE || 0,
    DOCUMENTS_REQUIRED: byStage.DOCUMENTS_REQUIRED || 0,
    COMPLETE: byStage.COMPLETE || 0,
  };

  // Count documents needed
  const documentsNeeded = clients.filter(client =>
    client.documents.required > client.documents.fulfilled
  ).length;

  // Count stalled clients
  const stalled = clients.filter(client =>
    isStalled(client.lastActivity, client.stage)
  ).length;

  return {
    total,
    byStage: allStages,
    documentsNeeded,
    stalled,
  };
}

/**
 * Fetches detailed data for a single client including timeline and requirements
 */
export async function getClientDetail(advisorProfileId: string, clientId: string): Promise<ClientDetail> {
  // Verify advisor-client assignment exists (multi-tenant isolation)
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        include: {
          // Round-11 commit 2.1: clientProfile include removed (no
          // selectable columns remain after the §5.1 minimization).
          intakeInterviews: {
            orderBy: { updatedAt: 'desc' },
          },
          assessments: {
            orderBy: { completedAt: 'desc' },
            include: {
              scores: {
                orderBy: { calculatedAt: 'desc' },
                take: 1,
              }
            }
          }
        }
      }
    }
  });

  if (!assignment) {
    throw new Error('Client not found or not assigned to you');
  }

  const client = assignment.client;

  // Fetch invitation data
  const invitation = await prisma.inviteCode.findFirst({
    where: {
      createdBy: advisorProfileId,
      prefillEmail: client.email,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch document requirements
  const documentRequirements = await prisma.documentRequirement.findMany({
    where: {
      advisorId: advisorProfileId,
      clientId,
    },
    orderBy: { createdAt: 'asc' }
  });

  // Get the latest intake and assessment
  const latestIntake = client.intakeInterviews[0];
  const latestAssessment = client.assessments[0];

  // Build timeline events
  const events: WorkflowEvent[] = [];

  // Client assignment
  events.push({
    stage: 'INVITED',
    label: 'Client Assigned',
    date: assignment.assignedAt,
    detail: 'Advisor-client relationship established'
  });

  // Invitation events
  if (invitation) {
    events.push({
      stage: 'INVITED',
      label: 'Invitation Sent',
      date: invitation.createdAt,
      detail: `Invitation code: ${invitation.code}`
    });

    if (invitation.status !== 'SENT' && invitation.statusUpdatedAt) {
      events.push({
        stage: invitation.status === 'REGISTERED' ? 'REGISTERED' : 'INVITED',
        label: invitation.status === 'REGISTERED' ? 'Client Registered' : 'Invitation Updated',
        date: invitation.statusUpdatedAt,
        detail: `Status changed to ${invitation.status.toLowerCase()}`
      });
    }
  }

  // Intake events
  if (latestIntake) {
    if (latestIntake.status === 'IN_PROGRESS') {
      events.push({
        stage: 'INTAKE_IN_PROGRESS',
        label: 'Intake Started',
        date: latestIntake.startedAt || latestIntake.updatedAt,
        detail: 'Client began answering intake questions'
      });
    }

    if (latestIntake.submittedAt) {
      events.push({
        stage: 'INTAKE_COMPLETE',
        label: 'Intake Completed',
        date: latestIntake.submittedAt,
        detail: 'All intake questions answered'
      });
    }
  }

  // Assessment events
  if (latestAssessment) {
    events.push({
      stage: 'ASSESSMENT_IN_PROGRESS',
      label: 'Assessment Started',
      date: latestAssessment.startedAt || latestAssessment.updatedAt,
      detail: 'Risk assessment began'
    });

    if (latestAssessment.completedAt) {
      const score = latestAssessment.scores[0]?.score;
      events.push({
        stage: 'ASSESSMENT_COMPLETE',
        label: 'Assessment Completed',
        date: latestAssessment.completedAt,
        detail: score ? `Risk score: ${score}` : 'Assessment finished'
      });
    }
  }

  // Sort timeline chronologically
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build document counts for stage computation
  const docCounts = documentRequirements.reduce(
    (acc, req) => {
      if (req.fulfilled) acc.fulfilled++;
      else acc.required++;
      return acc;
    },
    { required: 0, fulfilled: 0 }
  );

  const intakeWaived = assignment.intakeWaivedAt != null;
  const intakeForStageDetail =
    latestIntake != null
      ? {
          status: latestIntake.status,
          updatedAt: latestIntake.updatedAt,
          submittedAt: latestIntake.submittedAt,
          waived: intakeWaived,
        }
      : intakeWaived
        ? {
            status: "NOT_STARTED" as const,
            updatedAt: assignment.assignedAt,
            submittedAt: null as Date | null,
            waived: true as const,
          }
        : undefined;

  // Compute current stage and build pipeline client
  const stage = computeClientStage({
    invitation: invitation ? {
      status: invitation.status,
      statusUpdatedAt: invitation.statusUpdatedAt,
    } : undefined,
    intake: intakeForStageDetail,
    assessment: latestAssessment ? {
      status: latestAssessment.status,
      completedAt: latestAssessment.completedAt,
      updatedAt: latestAssessment.updatedAt,
    } : undefined,
    documents: docCounts
  });

  // Get most recent activity
  const activityDates = [
    assignment.assignedAt,
    invitation?.statusUpdatedAt,
    latestIntake?.updatedAt,
    latestAssessment?.updatedAt || latestAssessment?.completedAt,
  ].filter(Boolean) as Date[];

  const lastActivity = activityDates.length > 0
    ? new Date(Math.max(...activityDates.map(d => d.getTime())))
    : assignment.assignedAt;

  const pipelineClient: PipelineClient = {
    id: client.id,
    name: client.name,
    email: client.email,
    assignedAt: assignment.assignedAt,
    stage,
    progress: computeProgress(stage),
    lastActivity,
    invitation: invitation ? {
      status: invitation.status,
      sentAt: invitation.createdAt,
      code: invitation.code,
    } : null,
    intake: latestIntake
      ? {
          status: latestIntake.status,
          responseCount: await prisma.intakeResponse.count({
            where: whereIntakeResponseHasAnswer(latestIntake.id),
          }),
          submittedAt: latestIntake.submittedAt,
          waivedAt: assignment.intakeWaivedAt,
        }
      : intakeWaived
        ? {
            status: "NOT_STARTED",
            responseCount: 0,
            submittedAt: null,
            waivedAt: assignment.intakeWaivedAt,
          }
        : null,
    assessment: latestAssessment ? {
      status: latestAssessment.status,
      completedAt: latestAssessment.completedAt,
      score: latestAssessment.scores[0]?.score || null,
    } : null,
    documents: {
      required: docCounts.required,
      fulfilled: docCounts.fulfilled,
    }
  };

  // Build intake details
  let intakeDetails = null;
  if (latestIntake) {
    // Count questions based on responses since there's no template-based system
    const totalResponses = await prisma.intakeResponse.count({
      where: { interviewId: latestIntake.id }
    });

    const responseCount = await prisma.intakeResponse.count({
      where: whereIntakeResponseHasAnswer(latestIntake.id),
    });

    intakeDetails = {
      interviewId: latestIntake.id,
      status: latestIntake.status,
      responseCount,
      totalQuestions: totalResponses, // Use total response slots as proxy for questions
      submittedAt: latestIntake.submittedAt,
    };
  }

  // Build assessment details
  let assessmentDetails = null;
  if (latestAssessment && latestAssessment.scores[0]) {
    const score = latestAssessment.scores[0];

    // Get all pillar scores for this assessment
    const pillarScores = await prisma.pillarScore.findMany({
      where: { assessmentId: latestAssessment.id },
      orderBy: { pillar: 'asc' }
    });

    assessmentDetails = {
      status: latestAssessment.status,
      score: score.score,
      riskLevel: score.riskLevel,
      completedAt: latestAssessment.completedAt,
      pillarScores: pillarScores.map((pillar) => ({
        pillar: pillar.pillar,
        score: pillar.score,
        riskLevel: pillar.riskLevel,
      })),
    };
  } else if (latestAssessment) {
    assessmentDetails = {
      status: latestAssessment.status,
      score: null,
      riskLevel: null,
      completedAt: latestAssessment.completedAt,
      pillarScores: [],
    };
  }

  return {
    client: pipelineClient,
    advisorAssignment: {
      id: assignment.id,
      intakeWaivedAt: assignment.intakeWaivedAt,
    },
    timeline: events,
    documentRequirements: documentRequirements.map(req => ({
      id: req.id,
      name: req.name,
      description: req.description,
      required: req.required,
      fulfilled: req.fulfilled,
      fulfilledAt: req.fulfilledAt,
      createdAt: req.createdAt,
      fileName: req.fileName,
      fileSize: req.fileSize,
    })),
    intakeDetails,
    assessmentDetails,
  };
}