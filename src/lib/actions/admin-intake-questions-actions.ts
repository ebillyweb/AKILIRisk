"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PillarCategoryKind, type UserRole } from "@prisma/client";

import { requireAdminRole } from "@/lib/admin/auth";
import { normalizeIncludedPillarIds } from "@/lib/assessment/included-pillars";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

function revalidateIntakeQuestionContent(questionId?: string) {
  revalidatePath("/admin/intake/questions");
  revalidatePath("/admin/intake/questions", "layout");
  if (questionId) {
    revalidatePath(`/admin/intake/questions/${questionId}/edit`);
  }
  revalidatePath("/admin/intake");
  revalidatePath("/intake");
  revalidatePath("/intake/interview");
}

function optionalTrimmed(raw: FormDataEntryValue | null): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function formatActionError(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; ");
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

async function findIntakePillarQuestionOrThrow(questionId: string) {
  const row = await prisma.pillarQuestion.findFirst({
    where: {
      id: questionId,
      section: { category: { kind: PillarCategoryKind.INTAKE } },
    },
    include: { section: { include: { category: true } } },
  });
  if (!row) {
    throw new Error("Intake script question not found.");
  }
  return row;
}

export async function setIntakePillarQuestionVisibility(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));
  const raw = formData.get("setVisible");
  const isVisible = raw === "1" || raw === "true";

  const existing = await findIntakePillarQuestionOrThrow(questionId);

  await prisma.pillarQuestion.update({
    where: { id: questionId },
    data: { isVisible },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
    action: AUDIT_ACTIONS.INTAKE_QUESTION_VISIBILITY_TOGGLE,
    entityType: "PillarQuestion",
    entityId: questionId,
    beforeData: { isVisible: existing.isVisible },
    afterData: { isVisible },
    metadata: { categoryKind: "INTAKE" },
  });

  revalidateIntakeQuestionContent(questionId);
  // Same `?saved=1` redirect target the edit form uses. The query param
  // gives Next.js's client router a different cache key from the page that
  // submitted the form, which forces a fresh server render so the visibility
  // change is visible immediately. Without it, the prefetched RSC payload
  // for /admin/intake/questions sticks around and the user has to manually
  // refresh to see the updated badges and counts.
  redirect("/admin/intake/questions?saved=1");
}

export async function updateIntakePillarQuestionContent(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));

  try {
    const questionText = z.string().min(1).parse(formData.get("questionText"));
    const whyThisMatters = optionalTrimmed(formData.get("whyThisMatters"));
    const recommendedActions = optionalTrimmed(formData.get("recordingTips"));
    const displayOrder = z.coerce.number().int().min(0).parse(formData.get("displayOrder"));
    const isVisible = formData.has("isVisible");
    const relatedPillarIds = normalizeIncludedPillarIds(
      formData.getAll("relatedPillarIds").map((v) => String(v)),
    );

    const existing = await findIntakePillarQuestionOrThrow(questionId);

    await prisma.pillarQuestion.update({
      where: { id: questionId },
      data: {
        questionText,
        whyThisMatters,
        recommendedActions,
        displayOrder,
        isVisible,
        relatedPillarIds,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.INTAKE_QUESTION_UPDATE,
      entityType: "PillarQuestion",
      entityId: questionId,
      beforeData: {
        questionText: existing.questionText,
        whyThisMatters: existing.whyThisMatters,
        recommendedActions: existing.recommendedActions,
        displayOrder: existing.displayOrder,
        isVisible: existing.isVisible,
        relatedPillarIds: existing.relatedPillarIds,
      },
      afterData: {
        questionText,
        whyThisMatters,
        recommendedActions,
        displayOrder,
        isVisible,
        relatedPillarIds,
      },
      metadata: { categoryKind: "INTAKE" },
    });

    revalidateIntakeQuestionContent(questionId);
  } catch (e: unknown) {
    redirect(
      `/admin/intake/questions/${questionId}/edit?err=${encodeURIComponent(formatActionError(e))}`
    );
  }

  redirect("/admin/intake/questions?saved=1");
}
