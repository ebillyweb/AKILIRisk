"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { z } from "zod";

import { requireAdminRole } from "@/lib/admin/auth";
import {
  assessmentAnswerNoteInputSchema,
  intakeAnswerNoteInputSchema,
} from "@/lib/admin/answer-note-schemas";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type AnswerNoteActionResult =
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
  revalidatePath("/admin/intake");
  revalidatePath(`/admin/intake/${interviewId}`);
}

function revalidateAssessmentReviewPaths(assessmentId: string) {
  revalidatePath("/admin/assessment");
  revalidatePath(`/admin/assessment/${assessmentId}`);
}

export async function saveIntakeResponseAdminNote(input: {
  intakeResponseId: string;
  body: string;
}): Promise<AnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdminRole();
    const parsed = intakeAnswerNoteInputSchema.parse(input);

    const response = await prisma.intakeResponse.findUnique({
      where: { id: parsed.intakeResponseId },
      select: {
        id: true,
        interviewId: true,
        adminNote: { select: { id: true, body: true } },
      },
    });
    if (!response) {
      return { success: false, error: "Intake response not found." };
    }

    const existing = response.adminNote;
    if (existing) {
      const updated = await prisma.intakeResponseAdminNote.update({
        where: { id: existing.id },
        data: { body: parsed.body, updatedByUserId: userId },
      });
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_UPDATE,
        entityType: "IntakeResponseAdminNote",
        entityId: updated.id,
        beforeData: { body: existing.body },
        afterData: { body: updated.body },
        metadata: {
          intakeResponseId: response.id,
          interviewId: response.interviewId,
        },
      });
    } else {
      const created = await prisma.intakeResponseAdminNote.create({
        data: {
          intakeResponseId: response.id,
          body: parsed.body,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_CREATE,
        entityType: "IntakeResponseAdminNote",
        entityId: created.id,
        beforeData: null,
        afterData: { body: created.body },
        metadata: {
          intakeResponseId: response.id,
          interviewId: response.interviewId,
        },
      });
    }

    revalidateIntakeReviewPaths(response.interviewId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}

export async function deleteIntakeResponseAdminNote(
  intakeResponseId: string
): Promise<AnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdminRole();
    const id = z.string().min(1).parse(intakeResponseId);

    const response = await prisma.intakeResponse.findUnique({
      where: { id },
      select: {
        id: true,
        interviewId: true,
        adminNote: { select: { id: true, body: true } },
      },
    });
    if (!response?.adminNote) {
      return { success: false, error: "No admin note on this response." };
    }

    await prisma.intakeResponseAdminNote.delete({
      where: { id: response.adminNote.id },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_DELETE,
      entityType: "IntakeResponseAdminNote",
      entityId: response.adminNote.id,
      beforeData: { body: response.adminNote.body },
      afterData: null,
      metadata: {
        intakeResponseId: response.id,
        interviewId: response.interviewId,
      },
    });

    revalidateIntakeReviewPaths(response.interviewId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}

export async function saveAssessmentResponseAdminNote(input: {
  assessmentResponseId: string;
  body: string;
}): Promise<AnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdminRole();
    const parsed = assessmentAnswerNoteInputSchema.parse(input);

    const response = await prisma.assessmentResponse.findUnique({
      where: { id: parsed.assessmentResponseId },
      select: {
        id: true,
        assessmentId: true,
        adminNote: { select: { id: true, body: true } },
      },
    });
    if (!response) {
      return { success: false, error: "Assessment response not found." };
    }

    const existing = response.adminNote;
    if (existing) {
      const updated = await prisma.assessmentResponseAdminNote.update({
        where: { id: existing.id },
        data: { body: parsed.body, updatedByUserId: userId },
      });
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_NOTE_UPDATE,
        entityType: "AssessmentResponseAdminNote",
        entityId: updated.id,
        beforeData: { body: existing.body },
        afterData: { body: updated.body },
        metadata: {
          assessmentResponseId: response.id,
          assessmentId: response.assessmentId,
        },
      });
    } else {
      const created = await prisma.assessmentResponseAdminNote.create({
        data: {
          assessmentResponseId: response.id,
          body: parsed.body,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });
      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_NOTE_CREATE,
        entityType: "AssessmentResponseAdminNote",
        entityId: created.id,
        beforeData: null,
        afterData: { body: created.body },
        metadata: {
          assessmentResponseId: response.id,
          assessmentId: response.assessmentId,
        },
      });
    }

    revalidateAssessmentReviewPaths(response.assessmentId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}

export async function deleteAssessmentResponseAdminNote(
  assessmentResponseId: string
): Promise<AnswerNoteActionResult> {
  try {
    const { userId, email, role } = await requireAdminRole();
    const id = z.string().min(1).parse(assessmentResponseId);

    const response = await prisma.assessmentResponse.findUnique({
      where: { id },
      select: {
        id: true,
        assessmentId: true,
        adminNote: { select: { id: true, body: true } },
      },
    });
    if (!response?.adminNote) {
      return { success: false, error: "No admin note on this response." };
    }

    await prisma.assessmentResponseAdminNote.delete({
      where: { id: response.adminNote.id },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.ASSESSMENT_RESPONSE_NOTE_DELETE,
      entityType: "AssessmentResponseAdminNote",
      entityId: response.adminNote.id,
      beforeData: { body: response.adminNote.body },
      afterData: null,
      metadata: {
        assessmentResponseId: response.id,
        assessmentId: response.assessmentId,
      },
    });

    revalidateAssessmentReviewPaths(response.assessmentId);
    return { success: true };
  } catch (e) {
    return { success: false, error: formatActionError(e) };
  }
}
