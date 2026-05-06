'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RiskLevel } from '@prisma/client';
import { prisma } from '@/lib/db';

import { requireAdvisorRole, getAdvisorProfileOrThrow } from '@/lib/advisor/auth';
import {
  getAssignedClients,
  getClientIntakeForReview,
  createIntakeApproval,
  updateIntakeApproval,
  getAdvisorNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/data/advisor';
import { getAdvisorDashboardClients, getDashboardMetrics } from '@/lib/dashboard/queries';
import { getFamilyGovernanceTrends } from '@/lib/analytics/queries';
import { getPortfolioIntelligence, getTopRisksForFamily, getRiskDetailForFamily, getPortfolioPillarScores } from '@/lib/intelligence/queries';
import { approveClientSchema } from '@/lib/schemas/advisor';
import { decryptUserEmail } from '@/lib/auth/user-email';
import { loadIntakeScriptQuestions } from '@/lib/intake/load-intake-script';
import { toAdvisorHouseholdMemberViews } from '@/lib/profiles/advisor-household-view';
import type { IntakeReviewData } from '@/lib/advisor/types';
import { getAdvisorInvitations } from '@/lib/invitations/service';
import { InvitationStatus } from '@prisma/client';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';
import type { UserRole } from '@prisma/client';

export async function getAdvisorDashboardData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const clients = await getAssignedClients(profile.id);
    const notifications = await getAdvisorNotifications(profile.id);
    const unreadNotificationCount = notifications.filter(n => !n.read).length;

    // Get pending invitations count (SENT or OPENED status)
    const invitations = await getAdvisorInvitations(profile.id);
    const pendingInvitationsCount = invitations.filter(
      inv => inv.status === InvitationStatus.SENT || inv.status === InvitationStatus.OPENED
    ).length;

    return {
      success: true,
      data: {
        clients,
        profile,
        unreadNotificationCount,
        pendingInvitationsCount,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get advisor dashboard data';
    return { success: false, error: message };
  }
}

export async function getGovernanceDashboardData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const clients = await getAdvisorDashboardClients(profile.id);
    const metrics = getDashboardMetrics(clients);

    return {
      success: true,
      data: {
        clients,
        metrics,
        profile,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get governance dashboard data';
    return { success: false, error: message };
  }
}

export async function getIntakeReviewData(interviewId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = z.object({ interviewId: z.string().min(1) }).safeParse({ interviewId });
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid interview ID',
      };
    }

    const reviewData = await getClientIntakeForReview(profile.id, interviewId);
    if (!reviewData) {
      return {
        success: false,
        error: 'Interview not found or not assigned to you',
      };
    }

    const script = await loadIntakeScriptQuestions();

    const rawHouseholdMembers = await prisma.householdMember.findMany({
      where: { userId: reviewData.interview.userId },
      orderBy: { createdAt: 'asc' },
    });
    const householdMembers = toAdvisorHouseholdMemberViews(rawHouseholdMembers);

    const intakeReviewData: IntakeReviewData = {
      interview: reviewData.interview,
      approval: reviewData.approval,
      questions: script.map((q) => ({
        id: q.id,
        text: q.questionText,
        helpText: q.context,
        type: 'audio',
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        context: q.context,
        whyThisMatters: q.whyThisMatters,
        recordingTips: q.recordingTips,
      })),
      householdMembers,
    };

    return {
      success: true,
      data: intakeReviewData,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get intake review data';
    return { success: false, error: message };
  }
}

/**
 * Gate intake-approval mutations on an ACTIVE ClientAdvisorAssignment from
 * the calling advisor to the intake's owning client. Without this, the
 * Prisma upsert on `IntakeApproval { interviewId @unique }` would let any
 * authenticated advisor mutate any other advisor's existing approval row
 * (the upsert returns the existing row to the wrong advisor, and the
 * subsequent updateIntakeApproval rewrites status/focusAreas/notes).
 *
 * Returns the verified review wrapper on success, or null when the
 * advisor has no business touching this approval.
 */
async function assertAdvisorMayMutateApproval(
  advisorProfileId: string,
  interviewId: string
) {
  // getClientIntakeForReview already filters on
  //   user.clientAssignments.some({ advisorId, status: ACTIVE })
  // so a null return means "this interview belongs to a client you're
  // not actively assigned to."
  return getClientIntakeForReview(advisorProfileId, interviewId);
}

export async function markIntakeInReview(interviewId: string) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = z.object({ interviewId: z.string().min(1) }).safeParse({ interviewId });
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid interview ID',
      };
    }

    // Multi-tenant boundary: only an advisor with an ACTIVE assignment
    // to this client may touch the approval. Generic "not found" message
    // so a probing advisor can't distinguish "no such interview" from
    // "exists but not yours."
    const reviewData = await assertAdvisorMayMutateApproval(
      profile.id,
      interviewId
    );
    if (!reviewData) {
      return {
        success: false,
        error: 'Interview not found or not assigned to you',
      };
    }

    // Create approval if it doesn't exist (no-op when one is present)
    const priorApproval = await createIntakeApproval(interviewId, profile.id);
    let approval = priorApproval;

    // Update to IN_REVIEW status if it's currently PENDING
    let statusChanged = false;
    if (approval.status === 'PENDING') {
      approval = await updateIntakeApproval(approval.id, {
        status: 'IN_REVIEW',
        reviewedAt: new Date(),
      });
      statusChanged = true;
    }

    // Audit only when the status actually transitioned. A no-op call (already
    // IN_REVIEW) shouldn't produce an audit row — same shape as the existing
    // SubscriptionAuditLog convention of recording state transitions, not
    // idempotent reads.
    if (statusChanged) {
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.INTAKE_REVIEW_STARTED,
        entityType: 'IntakeApproval',
        entityId: approval.id,
        beforeData: { status: priorApproval.status },
        afterData: { status: approval.status, reviewedAt: approval.reviewedAt?.toISOString() ?? null },
        metadata: { interviewId, advisorId: profile.id },
      });
    }

    revalidatePath('/advisor/review/[id]', 'page');
    return {
      success: true,
      data: approval,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark intake in review';
    return { success: false, error: message };
  }
}

export async function approveClientIntake(data: unknown) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = approveClientSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { interviewId, focusAreas, notes } = validatedFields.data;

    // Multi-tenant boundary check (see assertAdvisorMayMutateApproval).
    const reviewData = await assertAdvisorMayMutateApproval(
      profile.id,
      interviewId
    );
    if (!reviewData) {
      return {
        success: false,
        error: 'Interview not found or not assigned to you',
      };
    }

    // First ensure an approval exists
    const priorApproval = await createIntakeApproval(interviewId, profile.id);
    let approval = priorApproval;

    // Update to APPROVED status with focus areas and notes
    approval = await updateIntakeApproval(approval.id, {
      status: 'APPROVED',
      focusAreas,
      notes,
      approvedAt: new Date(),
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_APPROVE,
      entityType: 'IntakeApproval',
      entityId: approval.id,
      beforeData: { status: priorApproval.status, focusAreas: priorApproval.focusAreas, notes: priorApproval.notes },
      afterData: { status: approval.status, focusAreas: approval.focusAreas, notes: approval.notes, approvedAt: approval.approvedAt?.toISOString() ?? null },
      metadata: { interviewId, advisorId: profile.id },
    });

    revalidatePath('/advisor/review/[id]', 'page');
    revalidatePath('/advisor');
    return {
      success: true,
      data: approval,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve client intake';
    return { success: false, error: message };
  }
}

export async function rejectClientIntake(approvalId: string, notes?: string) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = z.object({
      approvalId: z.string().cuid(),
      notes: z.string().optional(),
    }).safeParse({ approvalId, notes });

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid approval ID',
      };
    }

    // Look up the approval first so we can both run the multi-tenant
    // assignment check (same as the other actions) AND verify the
    // existing approval is owned by the calling advisor — so even an
    // advisor with a valid assignment can't override another assigned
    // advisor's decision. Today's data model has one assigned advisor
    // per client at a time, but we don't want to rely on that.
    const existing = await prisma.intakeApproval.findUnique({
      where: { id: approvalId },
      // status + notes selected so the audit row's beforeData reflects actual
      // prior state, not a placeholder. Tiny extra column read; no extra
      // round-trip.
      select: {
        id: true,
        advisorId: true,
        interviewId: true,
        status: true,
        notes: true,
      },
    });
    if (!existing) {
      return { success: false, error: 'Approval not found' };
    }

    const reviewData = await assertAdvisorMayMutateApproval(
      profile.id,
      existing.interviewId
    );
    if (!reviewData) {
      return {
        success: false,
        error: 'Approval not found or not assigned to you',
      };
    }

    if (existing.advisorId !== profile.id) {
      // Generic "not found" shape so we don't reveal which advisor owns
      // the row.
      return {
        success: false,
        error: 'Approval not found or not assigned to you',
      };
    }

    const approval = await updateIntakeApproval(approvalId, {
      status: 'REJECTED',
      notes,
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_REJECT,
      entityType: 'IntakeApproval',
      entityId: approval.id,
      beforeData: { status: existing.status, notes: existing.notes },
      afterData: { status: approval.status, notes: approval.notes },
      metadata: { interviewId: existing.interviewId, advisorId: profile.id },
    });

    revalidatePath('/advisor/review/[id]', 'page');
    revalidatePath('/advisor');
    return {
      success: true,
      data: approval,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject client intake';
    return { success: false, error: message };
  }
}

export async function getAdvisorNotificationsAction() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const notifications = await getAdvisorNotifications(profile.id);

    return {
      success: true,
      data: notifications,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get advisor notifications';
    return { success: false, error: message };
  }
}

export async function markNotificationReadAction(notificationId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = z.object({ notificationId: z.string().cuid() }).safeParse({ notificationId });
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid notification ID',
      };
    }

    await markNotificationRead(notificationId, profile.id);

    revalidatePath('/advisor');
    revalidatePath('/advisor/notifications');
    return {
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    return { success: false, error: message };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    await markAllNotificationsRead(profile.id);

    revalidatePath('/advisor');
    revalidatePath('/advisor/notifications');
    return {
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read';
    return { success: false, error: message };
  }
}

export async function getFamilyAnalyticsData(clientId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const data = await getFamilyGovernanceTrends(clientId, profile.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get family analytics data';
    return { success: false, error: message };
  }
}

export async function getPortfolioIntelligenceData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const data = await getPortfolioIntelligence(profile.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get portfolio intelligence data';
    return { success: false, error: message };
  }
}

/**
 * Round-10 / B1: per-client × per-pillar grid for the portfolio heat map
 * on /advisor/intelligence. Wraps `getPortfolioPillarScores` for the
 * server-component call site.
 */
export async function getPortfolioPillarScoresData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const data = await getPortfolioPillarScores(profile.id);
    return { success: true as const, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get portfolio heat-map data';
    return { success: false as const, error: message };
  }
}

export async function getFamilyRiskData(clientId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const data = await getTopRisksForFamily(clientId, profile.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get family risk data';
    return { success: false, error: message };
  }
}

export async function getFamilyRiskDetailData(familyId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const data = await getRiskDetailForFamily(familyId, profile.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get family risk detail data';
    return { success: false, error: message };
  }
}

function riskLevelFromNumericScore(score: number): RiskLevel {
  if (score <= 2.5) return 'CRITICAL';
  if (score < 5.0) return 'HIGH';
  if (score < 7.5) return 'MEDIUM';
  return 'LOW';
}

function extractCybersecurityFromPillarScore(score: {
  pillar: string;
  score: number;
  riskLevel: RiskLevel;
  breakdown: unknown;
  calculatedAt: Date;
}): { cyberScore: number; riskLevel: RiskLevel } | null {
  if (score.pillar === 'cyber-risk') {
    return { cyberScore: score.score, riskLevel: score.riskLevel };
  }
  if (score.pillar !== 'family-governance' || score.breakdown == null) {
    return null;
  }
  const rows = score.breakdown as Array<{ categoryId?: string; score?: number }>;
  const row = rows.find((r) => r.categoryId === 'cybersecurity');
  if (!row || typeof row.score !== 'number') {
    return null;
  }
  return {
    cyberScore: row.score,
    riskLevel: riskLevelFromNumericScore(row.score),
  };
}

export async function getCyberRiskDashboardData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    // Get advisor's assigned clients
    const assignments = await prisma.clientAdvisorAssignment.findMany({
      where: {
        advisorId: profile.id,
        status: 'ACTIVE',
      },
      include: {
        client: {
          include: {
            assessments: {
              where: {
                status: 'COMPLETED',
              },
              orderBy: {
                completedAt: 'desc',
              },
              include: {
                scores: true,
              },
            },
          },
        },
      },
    });

    // Build cyber risk client data (cybersecurity slice of comprehensive assessment, or legacy cyber-risk pillar)
    type CyberRiskClient = {
      id: string;
      name: string | null;
      email: string;
      cyberScore: number | null;
      riskLevel: RiskLevel | null;
      assessedAt: Date | null;
    };

    const clients: CyberRiskClient[] = assignments.map((assignment) => {
      let cyberScore: number | null = null;
      let riskLevel: RiskLevel | null = null;
      let assessedAt: Date | null = null;

      for (const assessment of assignment.client.assessments) {
        const governanceScores = assessment.scores
          .filter((s) => s.pillar === 'family-governance')
          .sort((a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime());
        for (const s of governanceScores) {
          const extracted = extractCybersecurityFromPillarScore(s);
          if (extracted) {
            cyberScore = extracted.cyberScore;
            riskLevel = extracted.riskLevel;
            assessedAt = s.calculatedAt;
            break;
          }
        }
        if (cyberScore !== null) break;

        const legacyCyber = assessment.scores
          .filter((s) => s.pillar === 'cyber-risk')
          .sort((a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime())[0];
        if (legacyCyber) {
          cyberScore = legacyCyber.score;
          riskLevel = legacyCyber.riskLevel;
          assessedAt = legacyCyber.calculatedAt;
          break;
        }
      }

      return {
        id: assignment.client.id,
        name: assignment.client.name,
        // Round-11 commit 2.4b: decrypt at exit.
        email: decryptUserEmail(assignment.client.emailCiphertext),
        cyberScore,
        riskLevel,
        assessedAt,
      };
    });

    // Calculate metrics
    type CyberRiskMetrics = {
      totalClients: number;
      assessedClients: number;
      averageScore: number | null;
      clientsAtRisk: number;
    };

    const assessedClients = clients.filter(c => c.cyberScore !== null);
    const clientsAtRisk = assessedClients.filter(c =>
      c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL'
    ).length;
    const averageScore = assessedClients.length > 0
      ? assessedClients.reduce((sum, c) => sum + c.cyberScore!, 0) / assessedClients.length
      : null;

    const metrics: CyberRiskMetrics = {
      totalClients: clients.length,
      assessedClients: assessedClients.length,
      averageScore,
      clientsAtRisk,
    };

    return {
      success: true,
      data: {
        clients,
        metrics,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get cyber risk dashboard data';
    return { success: false, error: message };
  }
}

export async function getIdentityRiskDashboardData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    // Get advisor's assigned clients
    const assignments = await prisma.clientAdvisorAssignment.findMany({
      where: {
        advisorId: profile.id,
        status: 'ACTIVE',
      },
      include: {
        client: {
          include: {
            assessments: {
              where: {
                status: 'COMPLETED',
              },
              include: {
                scores: {
                  where: {
                    pillar: 'identity-risk',
                  },
                  orderBy: {
                    calculatedAt: 'desc',
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Build identity risk client data
    type IdentityRiskClient = {
      id: string;
      name: string | null;
      email: string;
      identityScore: number | null;
      riskLevel: RiskLevel | null;
      assessedAt: Date | null;
    };

    const clients: IdentityRiskClient[] = assignments.map(assignment => {
      const identityAssessments = assignment.client.assessments.filter(a =>
        a.scores.some(s => s.pillar === 'identity-risk')
      );
      const latestIdentityAssessment = identityAssessments[0] || null;
      const latestIdentityScore = latestIdentityAssessment?.scores[0] || null;

      return {
        id: assignment.client.id,
        name: assignment.client.name,
        // Round-11 commit 2.4b: decrypt at exit.
        email: decryptUserEmail(assignment.client.emailCiphertext),
        identityScore: latestIdentityScore?.score || null,
        riskLevel: latestIdentityScore?.riskLevel || null,
        assessedAt: latestIdentityScore?.calculatedAt || null,
      };
    });

    // Calculate metrics
    type IdentityRiskMetrics = {
      totalClients: number;
      assessedClients: number;
      averageScore: number | null;
      clientsAtRisk: number;
    };

    const assessedClients = clients.filter(c => c.identityScore !== null);
    const clientsAtRisk = assessedClients.filter(c =>
      c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL'
    ).length;
    const averageScore = assessedClients.length > 0
      ? assessedClients.reduce((sum, c) => sum + c.identityScore!, 0) / assessedClients.length
      : null;

    const metrics: IdentityRiskMetrics = {
      totalClients: clients.length,
      assessedClients: assessedClients.length,
      averageScore,
      clientsAtRisk,
    };

    return {
      success: true,
      data: {
        clients,
        metrics,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get identity risk dashboard data';
    return { success: false, error: message };
  }
}

export async function updateAdvisorBranding(formData: FormData) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const logoUrl = formData.get('logoUrl')?.toString();

    // Validate logo URL if provided
    if (logoUrl && logoUrl.trim() !== '') {
      try {
        const url = new URL(logoUrl);
        if (url.protocol !== 'https:') {
          return {
            success: false,
            error: 'Logo URL must use HTTPS',
          };
        }
      } catch {
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }
    }

    // Update the advisor profile
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      await prisma.advisorProfile.update({
        where: { id: profile.id },
        data: {
          logoUrl: logoUrl && logoUrl.trim() !== '' ? logoUrl.trim() : null,
        },
      });

      revalidatePath('/advisor/settings');
      revalidatePath('/advisor');

      return {
        success: true,
        data: { logoUrl: logoUrl && logoUrl.trim() !== '' ? logoUrl.trim() : null },
      };
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update branding';
    return { success: false, error: message };
  }
}