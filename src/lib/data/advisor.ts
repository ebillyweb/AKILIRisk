import "server-only";

import { prisma } from "@/lib/db";
import type { AdvisorDashboardClient } from "@/lib/advisor/types";
import { decryptUserEmail } from "@/lib/auth/user-email";
import {
  loadAdvisorPiiPolicy,
  resolveAdvisorClientIdentity,
} from "@/lib/advisor/field-visibility";
import { safeDecryptTranscription } from "@/lib/data/response-content";
import { intakeResponsePlaybackUrl } from "@/lib/intake/playback-url";

export async function getAdvisorProfile(userId: string) {
  // Round-11 commit 2.4b: ciphertext + decrypt at exit so callers
  // keep reading `profile.user.email` as plaintext.
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          emailCiphertext: true,
        },
      },
    },
  });
  if (!profile) return null;
  return {
    ...profile,
    user: {
      ...profile.user,
      email: decryptUserEmail(profile.user.emailCiphertext),
    },
  };
}

export async function getAssignedClients(advisorProfileId: string): Promise<AdvisorDashboardClient[]> {
  const [assignments, advisorPolicy] = await Promise.all([
    prisma.clientAdvisorAssignment.findMany({
      where: {
        advisorId: advisorProfileId,
        status: 'ACTIVE',
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            emailCiphertext: true,
          },
        },
      },
    }),
    loadAdvisorPiiPolicy(advisorProfileId),
  ]);

  // Get all interviews for assigned clients so we can pick the right one per client
  const clientIds = assignments.map(a => a.client.id);
  const allInterviews = await prisma.intakeInterview.findMany({
    where: {
      userId: { in: clientIds },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      _count: {
        select: {
          responses: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Per client: prefer SUBMITTED interview (so advisor status matches what client completed); else latest by updatedAt
  const interviewsByClient = new Map<string, { id: string; status: string; submittedAt: Date | null; responseCount: number }>();
  for (const clientId of clientIds) {
    const clientInterviews = allInterviews.filter(i => i.userId === clientId);
    const submitted = clientInterviews.find(i => i.status === 'SUBMITTED');
    const chosen = submitted ?? clientInterviews[0] ?? null; // submitted takes precedence; else most recently updated
    if (chosen) {
      interviewsByClient.set(clientId, {
        id: chosen.id,
        status: chosen.status,
        submittedAt: chosen.submittedAt,
        responseCount: chosen._count.responses,
      });
    }
  }

  return assignments.map(assignment => {
    const identity = resolveAdvisorClientIdentity(
      assignment.client,
      assignment.fieldVisibility,
      advisorPolicy
    );
    return {
    id: assignment.client.id,
    name: identity.name,
    email: identity.email,
    assignedAt: assignment.assignedAt,
    // Round-11 commit 2.1: clientProfile field removed from
    // AdvisorDashboardClient — see src/lib/advisor/types.ts.
    latestInterview: interviewsByClient.get(assignment.client.id) || null,
  };
  });
}

export async function getClientIntakeForReview(
  advisorProfileId: string,
  interviewId: string,
  /**
   * US-46c: User id of the calling advisor — used to scope the
   * IntakeResponseAdvisorNote join to this advisor's own note. Optional
   * (back-compat) so callers that don't yet pass it (e.g. older test
   * fixtures) get a `null` advisorNote on every response rather than
   * crashing. New advisor-facing call sites should always pass it.
   */
  advisorUserId?: string,
) {
  // First verify the advisor has access to this client's interview
  const interview = await prisma.intakeInterview.findFirst({
    where: {
      id: interviewId,
      user: {
        clientAssignments: {
          some: {
            advisorId: advisorProfileId,
            status: 'ACTIVE',
          },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          // Round-11 commit 2.4b: ciphertext, decrypt at exit.
          emailCiphertext: true,
        },
      },
      responses: {
        orderBy: {
          questionId: 'asc',
        },
        include: advisorUserId
          ? {
              advisorNotes: {
                where: { advisorId: advisorUserId },
                select: { id: true, body: true, updatedAt: true },
                take: 1,
              },
            }
          : undefined,
      },
    },
  });

  if (!interview) {
    return null;
  }

  const clientAdvisorAssignmentDelegate = (
    prisma as unknown as {
      clientAdvisorAssignment?: {
        findFirst?: (args: {
          where: { advisorId: string; clientId: string; status: "ACTIVE" };
          select: { fieldVisibility: true };
        }) => Promise<{ fieldVisibility: unknown } | null>;
      };
    }
  ).clientAdvisorAssignment;

  const assignmentPromise = clientAdvisorAssignmentDelegate?.findFirst
    ? clientAdvisorAssignmentDelegate.findFirst({
        where: {
          advisorId: advisorProfileId,
          clientId: interview.userId,
          status: "ACTIVE",
        },
        select: { fieldVisibility: true },
      })
    : Promise.resolve(null);

  const [assignment, advisorPolicy] = await Promise.all([
    assignmentPromise,
    loadAdvisorPiiPolicy(advisorProfileId),
  ]);

  const identity = resolveAdvisorClientIdentity(
    interview.user,
    assignment?.fieldVisibility ?? null,
    advisorPolicy
  );

  // Get the approval if one exists
  const approval = await prisma.intakeApproval.findUnique({
    where: {
      interviewId: interviewId,
    },
  });

  return {
    interview: {
      ...interview,
      user: {
        ...interview.user,
        name: identity.name,
        email: identity.email,
      },
      // Round-11 bug-hunt fix (commit B / RISK 3): decrypt
      // transcription at the query-layer exit. Without this the
      // advisor review screen (AdvisorIntakeView.tsx ~line 256)
      // displayed the iv:tag:ct hex string instead of the actual
      // transcription text.
      // Round-11 cleanup: tamper-resilient decrypt — corrupted rows
      // surface as null instead of crashing the advisor review page.
      responses: interview.responses.map((r) => {
        // US-46c: filtered include returns 0-or-1 row for this advisor.
        // Reshape to a single `advisorNote` field for the UI.
        const advisorNotes = (r as unknown as {
          advisorNotes?: Array<{
            id: string;
            body: string;
            updatedAt: Date;
          }>;
        }).advisorNotes;
        const firstNote = advisorNotes && advisorNotes.length > 0 ? advisorNotes[0] : null;
        const advisorNote = firstNote
          ? {
              id: firstNote.id,
              body: firstNote.body,
              updatedAt: firstNote.updatedAt.toISOString(),
            }
          : null;
        return {
          ...r,
          audioUrl: r.audioS3Key
            ? (r.audioUrl ?? intakeResponsePlaybackUrl(interviewId, r.questionId))
            : r.audioUrl,
          transcription: safeDecryptTranscription(r.transcription, {
            rowId: r.id,
            column: "IntakeResponse.transcription",
          }),
          advisorNote,
        };
      }),
    },
    approval,
  };
}

export async function createIntakeApproval(interviewId: string, advisorProfileId: string) {
  return prisma.intakeApproval.upsert({
    where: {
      interviewId: interviewId,
    },
    create: {
      interviewId: interviewId,
      advisorId: advisorProfileId,
      status: 'PENDING',
    },
    update: {
      // Don't update anything if it already exists
    },
  });
}

export async function updateIntakeApproval(
  approvalId: string,
  data: {
    status?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
    focusAreas?: string[];
    notes?: string;
    reviewedAt?: Date;
    approvedAt?: Date;
  }
) {
  const updateData: any = { ...data };

  // Auto-set timestamps based on status
  if (data.status === 'APPROVED' && !data.approvedAt) {
    updateData.approvedAt = new Date();
  }
  if (data.status === 'IN_REVIEW' && !data.reviewedAt) {
    updateData.reviewedAt = new Date();
  }

  return prisma.intakeApproval.update({
    where: { id: approvalId },
    data: updateData,
  });
}

export async function getAdvisorNotifications(advisorProfileId: string, unreadOnly?: boolean) {
  return prisma.advisorNotification.findMany({
    where: {
      advisorId: advisorProfileId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });
}

export async function markNotificationRead(notificationId: string, advisorProfileId: string) {
  return prisma.advisorNotification.updateMany({
    where: {
      id: notificationId,
      advisorId: advisorProfileId, // Ownership check
    },
    data: {
      read: true,
    },
  });
}

export async function createNotification(
  advisorProfileId: string,
  type: 'NEW_INTAKE' | 'INTAKE_UPDATED' | 'NEW_LEAD' | 'SYSTEM',
  title: string,
  message: string,
  referenceId?: string
) {
  return prisma.advisorNotification.create({
    data: {
      advisorId: advisorProfileId,
      type,
      title,
      message,
      referenceId,
      read: false,
    },
  });
}

export async function markAllNotificationsRead(advisorProfileId: string) {
  return prisma.advisorNotification.updateMany({
    where: {
      advisorId: advisorProfileId,
      read: false,
    },
    data: {
      read: true,
    },
  });
}