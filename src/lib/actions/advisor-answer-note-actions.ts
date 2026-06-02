"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { z } from "zod";

import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import {
  assessmentAnswerAdvisorNoteInputSchema,
  intakeAnswerAdvisorNoteInputSchema,
} from "@/lib/advisor/advisor-note-schemas";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

/**
 * US-46c: advisor-scoped advisory notes on individual intake/assessment
 * answers. Mirrors the US-46b admin pattern at
 * `@/lib/actions/admin-answer-note-actions`, with two differences that
 * matter:
 *
 *  1. **Per-advisor scoping.** Each advisor has at most one note per answer
 *     (composite unique on `(responseId, advisorId)`). Two advisors on the
 *     same client coexist — `findUnique` is keyed on that composite, not on
 *     `responseId` alone.
 *  2. **Tenant isolation.** Every read/write verifies an ACTIVE
 *     `ClientAdvisorAssignment` between the calling advisor's profile and
 *     the response's owning client. Missing assignment surfaces as
 *     "Not found." so we don't leak existence to non-assigned advisors.
 */

export type AdvisorAnswerNoteActionResult =
  | { success: true }
  | { success: false; error: string };

function formatActionError(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues.map((i) => i.message).join("; ");
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

function revalidateIntakeReviewPaths(interviewId: string) {
  revalidatePath("/advisor/review");
  revalidatePath(`/advisor/review/${interviewId}`);
}

function revalidateAssessmentReviewPaths(clientId: string) {
  revalidatePath(`/advisor/pipeline/${clientId}`);
  revalidatePath(`/advisor/pipeline/${clientId}/report`);
  revalidatePath(`/advisor/pipeline/${clientId}/report/edit`);
}

/**
 * Confirm an ACTIVE assignment between the calling advisor and the client
 * who owns the intake response. Returns the response + ownership info on
 * success; `null` on either missing-response or no-assignment so callers
 * can't distinguish the two (avoiding existence-leakage).
 */
async function loadAssignedIntakeResponse(
  intakeResponseId: string,
  advisorProfileId: string,
  advisorUserId: string
) {
  const response = await prisma.intakeResponse.findUnique({
    where: { id: intakeResponseId },
    select: {
      id: true,
      interviewId: true,
      interview: { select: { userId: true } },
    },
  });
  if (!response) return null;

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId: response.interview.userId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!assignment) return null;

  const existing = await prisma.intakeResponseAdvisorNote.findUnique({
    where: {
      intakeResponseId_advisorId: {
        intakeResponseId: response.id,
        advisorId: advisorUserId,
      },
    },
    select: { id: true, body: true },
  });

  return {
    id: response.id,
    interviewId: response.interviewId,
    clientId: response.interview.userId,
    existing,
  };
}

async function loadAssignedAssessmentResponse(
  assessmentResponseId: string,
  advisorProfileId: string,
  advisorUserId: string
) {
  const response = await prisma.assessmentResponse.findUnique({
    where: { id: assessmentResponseId },
    select: {
      id: true,
      assessmentId: true,
      assessment: { select: { userId: true } },
    },
  });
  if (!response) return null;

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId: response.assessment.userId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!assignment) return null;

  const existing = await prisma.assessmentResponseAdvisorNote.findUnique({
    where: {
      assessmentResponseId_advisorId: {
        assessmentResponseId: response.id,
        advisorId: advisorUserId,
      },
    },
    select: { id: true, body: true },
  });

  return {
    id: response.id,
    assessmentId: response.assessmentId,
    clientId: response.assessment.userId,
    existing,
  };
}

export async function saveIntakeResponseAdvisorNote(input: {
  intakeResponseId: string;
  body: string;
}): Promise<AdvisorAnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const parsed = intakeAnswerAdvisorNoteInputSchema.parse(input);

    const response = await loadAssignedIntakeResponse(
      parsed.intakeResponseId,
      profile.id,
      userId
    );
    if (!response) {
      return { success: false, error: "Not found." };
    }

    const existing = response.existing;
    if (existing) {
      const updated = await prisma.intakeResponseAdvisorNote.update({
        where: { id: existing.id },
        data: { body: parsed.body, updatedByUserId: userId },
      });
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_UPDATE,
        entityType: "IntakeResponseAdvisorNote",
        entityId: updated.id,
        beforeData: { body: existing.body },
        afterData: { body: updated.body },
        metadata: {
          intakeResponseId: response.id,
          interviewId: response.interviewId,
          clientId: response.clientId,
          advisorId: userId,
        },
      });
    } else {
      try {
        const created = await prisma.intakeResponseAdvisorNote.create({
          data: {
            intakeResponseId: response.id,
            advisorId: userId,
            body: parsed.body,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });
        await writeAudit({
          actor: { userId, role: role as UserRole, email },
          action: AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_CREATE,
          entityType: "IntakeResponseAdvisorNote",
          entityId: created.id,
          beforeData: null,
          afterData: { body: created.body },
          metadata: {
            intakeResponseId: response.id,
            interviewId: response.interviewId,
            clientId: response.clientId,
            advisorId: userId,
          },
        });
      } catch (e: unknown) {
        // P2002 race: another concurrent save by the same advisor on the
        // same response created the row between our findUnique above and
        // this create. Promote to UPDATE so the second click "wins" with
        // the latest body, same as the admin equivalent would on retry.
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code?: string }).code === "P2002"
        ) {
          const updated = await prisma.intakeResponseAdvisorNote.update({
            where: {
              intakeResponseId_advisorId: {
                intakeResponseId: response.id,
                advisorId: userId,
              },
            },
            data: { body: parsed.body, updatedByUserId: userId },
          });
          await writeAudit({
            actor: { userId, role: role as UserRole, email },
            action: AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_UPDATE,
            entityType: "IntakeResponseAdvisorNote",
            entityId: updated.id,
            beforeData: null,
            afterData: { body: updated.body },
            metadata: {
              intakeResponseId: response.id,
              interviewId: response.interviewId,
              clientId: response.clientId,
              advisorId: userId,
              raceRecovery: true,
            },
          });
        } else {
          throw e;
        }
      }
    }

    revalidateIntakeReviewPaths(response.interviewId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}

export async function deleteIntakeResponseAdvisorNote(
  intakeResponseId: string
): Promise<AdvisorAnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const id = z.string().min(1).parse(intakeResponseId);

    const response = await loadAssignedIntakeResponse(id, profile.id, userId);
    if (!response) {
      return { success: false, error: "Not found." };
    }
    if (!response.existing) {
      return { success: false, error: "No advisor note on this response." };
    }

    await prisma.intakeResponseAdvisorNote.delete({
      where: { id: response.existing.id },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_DELETE,
      entityType: "IntakeResponseAdvisorNote",
      entityId: response.existing.id,
      beforeData: { body: response.existing.body },
      afterData: null,
      metadata: {
        intakeResponseId: response.id,
        interviewId: response.interviewId,
        clientId: response.clientId,
        advisorId: userId,
      },
    });

    revalidateIntakeReviewPaths(response.interviewId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}

export async function saveAssessmentResponseAdvisorNote(input: {
  assessmentResponseId: string;
  body: string;
}): Promise<AdvisorAnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const parsed = assessmentAnswerAdvisorNoteInputSchema.parse(input);

    const response = await loadAssignedAssessmentResponse(
      parsed.assessmentResponseId,
      profile.id,
      userId
    );
    if (!response) {
      return { success: false, error: "Not found." };
    }

    const existing = response.existing;
    if (existing) {
      const updated = await prisma.assessmentResponseAdvisorNote.update({
        where: { id: existing.id },
        data: { body: parsed.body, updatedByUserId: userId },
      });
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_UPDATE,
        entityType: "AssessmentResponseAdvisorNote",
        entityId: updated.id,
        beforeData: { body: existing.body },
        afterData: { body: updated.body },
        metadata: {
          assessmentResponseId: response.id,
          assessmentId: response.assessmentId,
          clientId: response.clientId,
          advisorId: userId,
        },
      });
    } else {
      try {
        const created = await prisma.assessmentResponseAdvisorNote.create({
          data: {
            assessmentResponseId: response.id,
            advisorId: userId,
            body: parsed.body,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });
        await writeAudit({
          actor: { userId, role: role as UserRole, email },
          action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_CREATE,
          entityType: "AssessmentResponseAdvisorNote",
          entityId: created.id,
          beforeData: null,
          afterData: { body: created.body },
          metadata: {
            assessmentResponseId: response.id,
            assessmentId: response.assessmentId,
            clientId: response.clientId,
            advisorId: userId,
          },
        });
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code?: string }).code === "P2002"
        ) {
          const updated = await prisma.assessmentResponseAdvisorNote.update({
            where: {
              assessmentResponseId_advisorId: {
                assessmentResponseId: response.id,
                advisorId: userId,
              },
            },
            data: { body: parsed.body, updatedByUserId: userId },
          });
          await writeAudit({
            actor: { userId, role: role as UserRole, email },
            action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_UPDATE,
            entityType: "AssessmentResponseAdvisorNote",
            entityId: updated.id,
            beforeData: null,
            afterData: { body: updated.body },
            metadata: {
              assessmentResponseId: response.id,
              assessmentId: response.assessmentId,
              clientId: response.clientId,
              advisorId: userId,
              raceRecovery: true,
            },
          });
        } else {
          throw e;
        }
      }
    }

    revalidateAssessmentReviewPaths(response.clientId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}

export async function deleteAssessmentResponseAdvisorNote(
  assessmentResponseId: string
): Promise<AdvisorAnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const id = z.string().min(1).parse(assessmentResponseId);

    const response = await loadAssignedAssessmentResponse(id, profile.id, userId);
    if (!response) {
      return { success: false, error: "Not found." };
    }
    if (!response.existing) {
      return { success: false, error: "No advisor note on this response." };
    }

    await prisma.assessmentResponseAdvisorNote.delete({
      where: { id: response.existing.id },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_DELETE,
      entityType: "AssessmentResponseAdvisorNote",
      entityId: response.existing.id,
      beforeData: { body: response.existing.body },
      afterData: null,
      metadata: {
        assessmentResponseId: response.id,
        assessmentId: response.assessmentId,
        clientId: response.clientId,
        advisorId: userId,
      },
    });

    revalidateAssessmentReviewPaths(response.clientId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}
