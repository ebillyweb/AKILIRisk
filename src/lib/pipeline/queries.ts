import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { PipelineClient, PipelineMetrics, ClientWorkflowStage, ClientDetail, WorkflowEvent } from "./types";
import { aggregateMandatoryDocumentCounts, hasUnfulfilledMandatoryDocuments } from "./documents";
import { assessmentNeedsRescore } from "@/lib/assessment/answers-changed-after-complete";
import { indexAwaitingIntakeReviewByClient, isIntakeAwaitingAdvisorReview } from "./intake-review";
import { pickIntakeForPipeline } from "./pick-intake-for-pipeline";
import { computeClientStage, computeProgress, isStalled } from "./status";
import { decryptUserEmail } from "@/lib/auth/user-email";
import {
  loadAdvisorPiiPolicy,
  resolveAdvisorClientIdentity,
} from "@/lib/advisor/field-visibility";
import {
  getClientEngagementScope,
} from "@/lib/client/engagement-scope";
import type { PortfolioScope } from "@/lib/enterprise/portfolio-access";
import {
  listAdvisorProfileIdsForScope,
  findPortfolioAssignmentForClient,
  resolvePortfolioScope,
} from "@/lib/enterprise/portfolio-access";

/** Voice answers often omit `answeredAt` until later; typed answers set it. */
function whereIntakeResponseHasAnswer(interviewId: string): Prisma.IntakeResponseWhereInput {
  return {
    interviewId,
    OR: [
      { answeredAt: { not: null } },
      { audioUrl: { not: null } },
      // Round-11 commit 2.5b: transcription is now ciphertext; the
      // denormalized `hasTranscription` boolean replaces the old
      // "non-null + non-empty" plaintext predicate.
      { hasTranscription: true },
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
      // Round-11 commit 2.5b: transcription is now ciphertext; the
      // denormalized `hasTranscription` boolean replaces the old
      // "non-null + non-empty" plaintext predicate.
      { hasTranscription: true },
    ],
  };
}

/**
 * Fetches complete pipeline data for an advisor's clients
 */
export type ClientPipelineOptions = {
  assignmentStatus?: 'ACTIVE' | 'INACTIVE';
};

export async function getClientPipelineForAdvisorUser(
  userId: string,
  options: ClientPipelineOptions = {},
): Promise<PipelineClient[]> {
  const scope = await resolvePortfolioScope(userId);
  if (!scope) return [];
  return getClientPipeline(scope, options);
}

export async function getClientPipeline(
  scope: PortfolioScope,
  options: ClientPipelineOptions = {},
): Promise<PipelineClient[]> {
  const assignmentStatus = options.assignmentStatus ?? 'ACTIVE';
  const advisorProfileIds = await listAdvisorProfileIdsForScope(scope);
  if (advisorProfileIds.length === 0) return [];

  const assignmentWhere =
    scope.mode === "firm"
      ? {
          advisor: { enterpriseId: scope.enterpriseId },
          status: assignmentStatus,
        }
      : {
          advisorId: scope.advisorProfileId,
          status: assignmentStatus,
        };

  const policyEntries = await Promise.all(
    advisorProfileIds.map(async (id) => [id, await loadAdvisorPiiPolicy(id)] as const)
  );
  const policyByAdvisorId = new Map<
    string,
    Awaited<ReturnType<typeof loadAdvisorPiiPolicy>>
  >(policyEntries);
  const defaultPolicy =
    policyByAdvisorId.get(scope.advisorProfileId) ??
    policyEntries[0]?.[1];

  const [assignments] = await Promise.all([
    prisma.clientAdvisorAssignment.findMany({
    where: assignmentWhere,
    include: {
      client: {
        include: {
          assessments: {
            orderBy: {
              updatedAt: 'desc',
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
  }),
  ]);

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
        // Round-11 commit 2.4b: client.email is gone; decrypt
        // ciphertext for the invite-prefill lookup batch below.
        .map((a) => decryptUserEmail(a.client.emailCiphertext))
        .filter((email): email is string => typeof email === 'string' && email.length > 0)
    )
  );
  const clientIds = Array.from(new Set(assignments.map((a) => a.client.id)));

  const [invitations, documentCounts, intakeInterviews, intakeApprovals] =
    await Promise.all([
    clientEmails.length > 0
      ? prisma.inviteCode.findMany({
          where: {
            createdBy: { in: advisorProfileIds },
            prefillEmail: { in: clientEmails },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    clientIds.length > 0
      ? prisma.documentRequirement.findMany({
          where: {
            advisorId: { in: advisorProfileIds },
            clientId: { in: clientIds },
          },
          select: {
            clientId: true,
            required: true,
            fulfilled: true,
          },
        })
      : Promise.resolve([]),
    clientIds.length > 0
      ? prisma.intakeInterview.findMany({
          where: { userId: { in: clientIds } },
          select: {
            id: true,
            userId: true,
            status: true,
            submittedAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.intakeApproval.findMany({
      where: { advisorId: { in: advisorProfileIds } },
      select: { interviewId: true, status: true },
    }),
  ]);

  const interviewsByUserId = new Map<string, typeof intakeInterviews>();
  for (const interview of intakeInterviews) {
    const rows = interviewsByUserId.get(interview.userId) ?? [];
    rows.push(interview);
    interviewsByUserId.set(interview.userId, rows);
  }

  const effectiveIntakeByUserId = new Map<string, (typeof intakeInterviews)[number]>();
  for (const [userId, rows] of interviewsByUserId) {
    const picked = pickIntakeForPipeline(rows);
    if (picked) {
      effectiveIntakeByUserId.set(userId, picked);
    }
  }

  const latestIntakeIds = Array.from(
    new Set(
      Array.from(effectiveIntakeByUserId.values()).map((interview) => interview.id),
    ),
  );

  const intakeResponseCounts =
    latestIntakeIds.length > 0
      ? await prisma.intakeResponse.groupBy({
          by: ['interviewId'],
          where: whereIntakeResponsesForInterviewsHaveAnswer(latestIntakeIds),
          _count: { _all: true },
        })
      : [];

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

  const documentCountsByClient = aggregateMandatoryDocumentCounts(documentCounts);

  const waivedByClientId = new Map(
    assignments.map((a) => [a.client.id, a.intakeWaivedAt != null]),
  );
  const assessmentCompletedByClientId = new Map(
    assignments.map((a) => [
      a.client.id,
      a.client.assessments[0]?.status === "COMPLETED",
    ]),
  );
  const intakeReviewByClient = indexAwaitingIntakeReviewByClient(
    intakeInterviews,
    intakeApprovals,
    waivedByClientId,
    assessmentCompletedByClientId,
  );

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
    const advisorPolicy =
      policyByAdvisorId.get(assignment.advisorId) ?? defaultPolicy;
    const clientIdentity = resolveAdvisorClientIdentity(
      client,
      assignment.fieldVisibility,
      advisorPolicy
    );
    const clientEmail = clientIdentity.email;
    const clientDisplayName = clientIdentity.name;

    const invitation = invitationByEmail.get(clientEmail) ?? null;
    const docCounts = documentCountsByClient.get(client.id) ?? {
      required: 0,
      fulfilled: 0,
    };

    // Get the most recent activity date
    const latestIntake = effectiveIntakeByUserId.get(client.id) ?? null;
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
        required: docCounts.required,
        fulfilled: docCounts.fulfilled,
      },
    });

    const stalled = isStalled(lastActivity, stage);
    const intakeReview = intakeReviewByClient.get(client.id) ?? {
      awaiting: false,
      interviewId: null,
    };
    const documentsNeeded = hasUnfulfilledMandatoryDocuments(docCounts);
    const needsRescore = latestAssessment
      ? assessmentNeedsRescore(latestAssessment)
      : false;

    const pipelineClient: PipelineClient = {
      id: client.id,
      name: clientDisplayName,
      firstName: client.firstName,
      lastName: client.lastName,
      email: clientEmail,
      assignedAt: assignment.assignedAt,
      stage,
      progress: computeProgress(stage),
      lastActivity,
      stalled,
      awaitingIntakeReview: intakeReview.awaiting,
      intakeReviewInterviewId: intakeReview.interviewId,
      documentsNeeded,
      needsRescore,
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
        version: latestAssessment.version,
        answersChangedAfterCompleteAt: latestAssessment.answersChangedAfterCompleteAt,
      } : null,
      documents: {
        required: docCounts.required,
        fulfilled: docCounts.fulfilled,
      },
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

  const documentsNeeded = clients.filter((client) => client.documentsNeeded).length;

  const needsRescore = clients.filter((client) => client.needsRescore).length;

  const stalled = clients.filter((client) => client.stalled).length;

  const intakesAwaitingReview = clients.filter(
    (client) => client.awaitingIntakeReview,
  ).length;

  return {
    total,
    byStage: allStages,
    documentsNeeded,
    needsRescore,
    stalled,
    intakesAwaitingReview,
    inactive: 0,
  };
}

export async function countInactiveClientAssignmentsForAdvisorUser(
  userId: string,
): Promise<number> {
  const scope = await resolvePortfolioScope(userId);
  if (!scope) return 0;
  return countInactiveClientAssignments(scope);
}

export async function countInactiveClientAssignments(
  scope: PortfolioScope,
): Promise<number> {
  if (scope.mode === "firm") {
    return prisma.clientAdvisorAssignment.count({
      where: {
        status: "INACTIVE",
        advisor: { enterpriseId: scope.enterpriseId },
      },
    });
  }
  return prisma.clientAdvisorAssignment.count({
    where: { advisorId: scope.advisorProfileId, status: "INACTIVE" },
  });
}

export async function getClientDetailForAdvisorUser(
  userId: string,
  clientId: string,
): Promise<ClientDetail> {
  const scope = await resolvePortfolioScope(userId);
  if (!scope) {
    throw new Error("Client not found or not assigned to you");
  }
  return getClientDetail(scope, clientId);
}

/**
 * Fetches detailed data for a single client including timeline and requirements
 */
export async function getClientDetail(
  scope: PortfolioScope,
  clientId: string,
): Promise<ClientDetail> {
  const access = await findPortfolioAssignmentForClient(scope, clientId, {
    includeInactive: true,
  });
  if (!access) {
    throw new Error("Client not found or not assigned to you");
  }
  const assignmentAdvisorProfileId = access.assignmentAdvisorProfileId;

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: assignmentAdvisorProfileId,
      clientId,
      status: { in: ['ACTIVE', 'INACTIVE'] },
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

  const advisorPolicy = await loadAdvisorPiiPolicy(assignmentAdvisorProfileId);
  const client = assignment.client;
  const clientIdentity = resolveAdvisorClientIdentity(
    client,
    assignment.fieldVisibility,
    advisorPolicy
  );
  const clientEmail = clientIdentity.email;
  const clientDisplayName = clientIdentity.name;

  // Fetch invitation data
  const invitation = await prisma.inviteCode.findFirst({
    where: {
      createdBy: assignmentAdvisorProfileId,
      prefillEmail: clientEmail,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch document requirements
  const documentRequirements = await prisma.documentRequirement.findMany({
    where: {
      advisorId: assignmentAdvisorProfileId,
      clientId,
    },
    orderBy: { createdAt: 'asc' }
  });

  // Get the effective intake and assessment for stage/timeline display
  const latestIntake = pickIntakeForPipeline(client.intakeInterviews);
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

  const docCounts = aggregateMandatoryDocumentCounts(
    documentRequirements.map((req) => ({
      clientId,
      required: req.required,
      fulfilled: req.fulfilled,
    })),
  ).get(clientId) ?? { required: 0, fulfilled: 0 };

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

  const stalled = isStalled(lastActivity, stage);
  const intakeApproval = latestIntake
    ? await prisma.intakeApproval.findUnique({
        where: { interviewId: latestIntake.id },
        select: { status: true },
      })
    : null;
  const awaitingIntakeReview = isIntakeAwaitingAdvisorReview(
    latestIntake,
    intakeApproval,
    intakeWaived,
    { assessmentCompleted: latestAssessment?.status === "COMPLETED" },
  );
  const documentsNeededFlag = hasUnfulfilledMandatoryDocuments(docCounts);
  const needsRescoreFlag = latestAssessment
    ? assessmentNeedsRescore(latestAssessment)
    : false;

  const pipelineClient: PipelineClient = {
    id: client.id,
    name: clientDisplayName,
    firstName: client.firstName,
    lastName: client.lastName,
    email: clientEmail,
    assignedAt: assignment.assignedAt,
    stage,
    progress: computeProgress(stage),
    lastActivity,
    stalled,
    awaitingIntakeReview,
    intakeReviewInterviewId: awaitingIntakeReview ? latestIntake?.id ?? null : null,
    documentsNeeded: documentsNeededFlag,
    needsRescore: needsRescoreFlag,
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
      version: latestAssessment.version,
      answersChangedAfterCompleteAt: latestAssessment.answersChangedAfterCompleteAt,
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
      id: latestAssessment.id,
      status: latestAssessment.status,
      score: score.score,
      riskLevel: score.riskLevel,
      completedAt: latestAssessment.completedAt,
      version: latestAssessment.version,
      answersChangedAfterCompleteAt: latestAssessment.answersChangedAfterCompleteAt,
      deliverablePhase: latestAssessment.deliverablePhase,
      pillarScores: pillarScores.map((pillar) => ({
        pillar: pillar.pillar,
        score: pillar.score,
        riskLevel: pillar.riskLevel,
      })),
    };
  } else if (latestAssessment) {
    assessmentDetails = {
      id: latestAssessment.id,
      status: latestAssessment.status,
      score: null,
      riskLevel: null,
      completedAt: latestAssessment.completedAt,
      version: latestAssessment.version,
      answersChangedAfterCompleteAt: latestAssessment.answersChangedAfterCompleteAt,
      deliverablePhase: latestAssessment.deliverablePhase,
      pillarScores: [],
    };
  }

  const engagementScope = await getClientEngagementScope(clientId);
  const { loadAdvisorAssessmentDomainOptions } = await import(
    "@/lib/methodology/advisor-assessment-domains"
  );
  const assessmentDomains = await loadAdvisorAssessmentDomainOptions(
    assignmentAdvisorProfileId,
  );
  const { getPlatformPillarCatalog } = await import(
    "@/lib/methodology/cached-pillar-catalog"
  );
  const pillarCatalog = await getPlatformPillarCatalog();

  return {
    client: pipelineClient,
    assessmentDomains,
    pillarCatalog,
    advisorAssignment: {
      id: assignment.id,
      status: assignment.status,
      intakeWaivedAt: assignment.intakeWaivedAt,
      includedPillars: engagementScope.includedPillars,
      focusAreas: engagementScope.focusAreas,
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