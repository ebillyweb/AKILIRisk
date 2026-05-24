"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { requireAdminRole } from "@/lib/admin/auth";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { reorderPillarQuestionInRiskArea } from "@/lib/assessment/bank/pillar-question-reorder";
import { isPillarQuestionBankActive } from "@/lib/assessment/bank/question-bank-source";
import { isRiskAreaId } from "@/lib/assessment/bank/risk-areas";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const PILLAR_ANSWER_TYPES = [
  "scored_0_3",
  "yes_no",
  "likert_5",
  "scale_1_5",
  "fillable",
  "number",
  "date_mm_yyyy",
] as const;

/** Postgres @db.Uuid — seed DDL uses non–RFC-v4 ids (e.g. …0001-…). */
const dbUuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

function revalidateQuestionBankPaths(riskAreaId?: string) {
  revalidatePath("/admin/question-bank");
  revalidatePath("/admin/question-bank", "layout");
  if (riskAreaId) {
    revalidatePath(`/admin/question-bank/${riskAreaId}`);
  }
  revalidatePath("/advisor/question-bank");
  revalidatePath("/advisor/question-bank", "layout");
}

function formatActionError(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; ");
  }
  if (e instanceof Error) {
    return e.message;
  }
  return "Something went wrong.";
}

function redirectCreateError(formData: FormData, message: string): never {
  const riskAreaId = formData.get("riskAreaId");
  const base =
    typeof riskAreaId === "string" && isRiskAreaId(riskAreaId)
      ? `/admin/question-bank/${riskAreaId}/new`
      : "/admin/question-bank";
  redirect(`${base}?err=${encodeURIComponent(message)}`);
}

function redirectUpdateError(formData: FormData, message: string): never {
  const riskAreaId = formData.get("riskAreaId");
  const questionId = formData.get("questionId");
  if (
    typeof riskAreaId === "string" &&
    isRiskAreaId(riskAreaId) &&
    typeof questionId === "string" &&
    questionId.length > 0
  ) {
    redirect(
      `/admin/question-bank/${riskAreaId}/${encodeURIComponent(questionId)}?err=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/admin/question-bank?err=${encodeURIComponent(message)}`);
}

function optionalFormString(raw: FormDataEntryValue | null): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export async function updatePillarQuestionVisibility(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));
  const isVisible = formData.get("isVisible") === "true";
  const riskAreaIdRaw = formData.get("riskAreaId");
  if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
    return;
  }
  const riskAreaId = riskAreaIdRaw;

  const row = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!row) return;
  if (riskAreaIdForPillarCategory(row.section.category) !== riskAreaId) {
    return;
  }

  await prisma.pillarQuestion.update({
    where: { id: questionId },
    data: { isVisible },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
    action: AUDIT_ACTIONS.PILLAR_QUESTION_VISIBILITY_TOGGLE,
    entityType: "PillarQuestion",
    entityId: row.id,
    beforeData: { isVisible: row.isVisible },
    afterData: { isVisible },
    metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
  });

  revalidateQuestionBankPaths(riskAreaId);
}

export async function deletePillarQuestion(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));
  const riskAreaIdRaw = formData.get("riskAreaId");
  if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
    redirect("/admin/question-bank");
  }
  const riskAreaId = riskAreaIdRaw;

  const row = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!row) {
    redirect(`/admin/question-bank/${riskAreaId}`);
  }
  if (riskAreaIdForPillarCategory(row.section.category) !== riskAreaId) {
    redirect(`/admin/question-bank/${riskAreaId}`);
  }

  await prisma.pillarQuestion.delete({ where: { id: questionId } });

  await writeAudit({
    actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
    action: AUDIT_ACTIONS.PILLAR_QUESTION_DELETE,
    entityType: "PillarQuestion",
    entityId: row.id,
    beforeData: {
      questionText: row.questionText,
      isVisible: row.isVisible,
      displayOrder: row.displayOrder,
      sectionId: row.sectionId,
    },
    afterData: null,
    metadata: { riskAreaId },
  });

  revalidateQuestionBankPaths(riskAreaId);
  redirect(`/admin/question-bank/${riskAreaId}`);
}

export async function updatePillarQuestionContent(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  try {
    const questionId = z.string().uuid().parse(formData.get("questionId"));
    const riskAreaIdRaw = formData.get("riskAreaId");
    if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
      throw new Error("Invalid risk area.");
    }
    const riskAreaId = riskAreaIdRaw;

    const text = z.string().min(1).parse(formData.get("text"));
    const helpText = optionalFormString(formData.get("helpText"));
    const riskRelevance = optionalFormString(formData.get("riskRelevance"));
    const whyThisMatters =
      [helpText, riskRelevance].filter((s): s is string => Boolean(s)).join("\n\n") || null;

    const learnMore = optionalFormString(formData.get("learnMore"));

    const answer0 = optionalFormString(formData.get("answer0"));
    const answer1 = optionalFormString(formData.get("answer1"));
    const answer2 = optionalFormString(formData.get("answer2"));
    const answer3 = optionalFormString(formData.get("answer3"));
    const crossReference = optionalFormString(formData.get("crossReference"));
    const questionNumberRaw = optionalFormString(formData.get("questionNumber"));
    const questionNumber =
      questionNumberRaw === null
        ? null
        : z.string().max(20).parse(questionNumberRaw);

    const displayOrder = z.coerce.number().int().min(0).parse(formData.get("displayOrder"));
    const isSubQuestion = formData.has("isSubQuestion");

    const existing = await prisma.pillarQuestion.findUnique({
      where: { id: questionId },
      include: { section: { include: { category: true } } },
    });
    if (!existing) {
      throw new Error("Pillar question not found.");
    }
    if (riskAreaIdForPillarCategory(existing.section.category) !== riskAreaId) {
      throw new Error("Question does not belong to this risk area.");
    }

    await prisma.pillarQuestion.update({
      where: { id: questionId },
      data: {
        questionText: text,
        whyThisMatters,
        recommendedActions: learnMore,
        answer0,
        answer1,
        answer2,
        answer3,
        crossReference,
        questionNumber,
        displayOrder,
        isSubQuestion,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.PILLAR_QUESTION_UPDATE,
      entityType: "PillarQuestion",
      entityId: existing.id,
      beforeData: {
        questionText: existing.questionText,
        whyThisMatters: existing.whyThisMatters,
        recommendedActions: existing.recommendedActions,
        answer0: existing.answer0,
        answer1: existing.answer1,
        answer2: existing.answer2,
        answer3: existing.answer3,
        crossReference: existing.crossReference,
        questionNumber: existing.questionNumber,
        displayOrder: existing.displayOrder,
        isSubQuestion: existing.isSubQuestion,
      },
      afterData: {
        questionText: text,
        whyThisMatters,
        recommendedActions: learnMore,
        answer0,
        answer1,
        answer2,
        answer3,
        crossReference,
        questionNumber,
        displayOrder,
        isSubQuestion,
      },
      metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
    });

    revalidateQuestionBankPaths(riskAreaId);
  } catch (e: unknown) {
    redirectUpdateError(formData, formatActionError(e));
  }
}

export async function createPillarQuestion(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  let riskAreaId: string;
  try {
    const riskAreaIdRaw = formData.get("riskAreaId");
    if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
      throw new Error("Invalid risk area.");
    }
    riskAreaId = riskAreaIdRaw;

    if (!(await isPillarQuestionBankActive())) {
      throw new Error(
        "Question bank is empty. Run npm run seed:pillar-ddl after migrations, then try again.",
      );
    }

    const sectionId = dbUuid.parse(formData.get("sectionId"));
    const text = z.string().min(1).parse(formData.get("text"));
    const answerType = z.enum(PILLAR_ANSWER_TYPES).parse(formData.get("answerType") ?? "scored_0_3");
    const isVisible = formData.has("isVisible");

    const section = await prisma.pillarSection.findUnique({
      where: { id: sectionId },
      include: { category: true },
    });
    if (!section || section.category.kind !== "ASSESSMENT") {
      throw new Error("Section not found.");
    }
    if (riskAreaIdForPillarCategory(section.category) !== riskAreaId) {
      throw new Error("Section does not belong to this risk area.");
    }

    const helpText = optionalFormString(formData.get("helpText"));
    const riskRelevance = optionalFormString(formData.get("riskRelevance"));
    const whyThisMatters =
      [helpText, riskRelevance].filter((s): s is string => Boolean(s)).join("\n\n") || null;
    const learnMore = optionalFormString(formData.get("learnMore"));
    const answer0 = optionalFormString(formData.get("answer0"));
    const answer1 = optionalFormString(formData.get("answer1"));
    const answer2 = optionalFormString(formData.get("answer2"));
    const answer3 = optionalFormString(formData.get("answer3"));
    const crossReference = optionalFormString(formData.get("crossReference"));
    const questionNumberRaw = optionalFormString(formData.get("questionNumber"));
    const questionNumber =
      questionNumberRaw === null ? null : z.string().max(20).parse(questionNumberRaw);
    const isSubQuestion = formData.has("isSubQuestion");

    const maxOrder = await prisma.pillarQuestion.aggregate({
      where: { sectionId },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    const created = await prisma.pillarQuestion.create({
      data: {
        sectionId,
        questionText: text,
        answerType,
        answer0,
        answer1,
        answer2,
        answer3,
        whyThisMatters,
        recommendedActions: learnMore,
        crossReference,
        questionNumber,
        displayOrder,
        isSubQuestion,
        isVisible,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.PILLAR_QUESTION_CREATE,
      entityType: "PillarQuestion",
      entityId: created.id,
      beforeData: null,
      afterData: {
        questionText: created.questionText,
        answerType: created.answerType,
        sectionId: created.sectionId,
        displayOrder: created.displayOrder,
        isVisible: created.isVisible,
      },
      metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
    });
  } catch (e: unknown) {
    redirectCreateError(formData, formatActionError(e));
  }

  revalidateQuestionBankPaths(riskAreaId);
  redirect(`/admin/question-bank/${riskAreaId}`);
}

export async function movePillarQuestionOrder(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const riskAreaIdRaw = formData.get("riskAreaId");
  if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
    return;
  }
  const riskAreaId = riskAreaIdRaw;

  const before = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!before) return;
  if (riskAreaIdForPillarCategory(before.section.category) !== riskAreaId) return;

  const result = await reorderPillarQuestionInRiskArea({
    riskAreaId,
    questionId,
    direction,
  });
  if (!result.ok) return;

  const after = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    select: { displayOrder: true, sectionId: true },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
    action: AUDIT_ACTIONS.PILLAR_QUESTION_REORDER,
    entityType: "PillarQuestion",
    entityId: questionId,
    beforeData: {
      displayOrder: before.displayOrder,
      sectionId: before.sectionId,
    },
    afterData: after
      ? { displayOrder: after.displayOrder, sectionId: after.sectionId }
      : null,
    metadata: {
      direction,
      riskAreaId,
      swappedWithId: result.swappedWithId,
    },
  });

  revalidateQuestionBankPaths(riskAreaId);
}
