"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { requireAdminRole } from "@/lib/admin/auth";
import { parsePillarDbUuid, pillarDbUuidSchema } from "@/lib/assessment/bank/pillar-db-uuid";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { reorderPillarQuestionInRiskArea } from "@/lib/assessment/bank/pillar-question-reorder";
import { isPillarQuestionBankActive } from "@/lib/assessment/bank/question-bank-source";
import { isRiskAreaId } from "@/lib/assessment/bank/risk-areas";
import { prisma } from "@/lib/db";
import {
  ADMIN_ASSESSMENT_QUESTIONS_PATH,
  adminAssessmentQuestionsAreaPath,
  adminAssessmentQuestionsEditPath,
  adminAssessmentQuestionsNewPath,
} from "@/lib/admin/assessment-questions-paths";
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

function revalidateQuestionBankPaths(riskAreaId?: string) {
  revalidatePath(ADMIN_ASSESSMENT_QUESTIONS_PATH);
  revalidatePath(ADMIN_ASSESSMENT_QUESTIONS_PATH, "layout");
  revalidatePath("/admin/assessment", "layout");
  if (riskAreaId) {
    revalidatePath(adminAssessmentQuestionsAreaPath(riskAreaId));
  }
  revalidatePath("/admin/question-bank");
  revalidatePath("/admin/question-bank", "layout");
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
      ? adminAssessmentQuestionsNewPath(riskAreaId)
      : ADMIN_ASSESSMENT_QUESTIONS_PATH;
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
      `${adminAssessmentQuestionsEditPath(riskAreaId, questionId)}?err=${encodeURIComponent(message)}`,
    );
  }
  redirect(`${ADMIN_ASSESSMENT_QUESTIONS_PATH}?err=${encodeURIComponent(message)}`);
}

function redirectAreaSaved(riskAreaId: string, extraQuery?: string): never {
  const q = extraQuery ? `&${extraQuery}` : "";
  redirect(`${adminAssessmentQuestionsAreaPath(riskAreaId)}?saved=1${q}`);
}

function parseRiskAreaIdFromForm(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !isRiskAreaId(raw)) {
    return null;
  }
  return raw;
}

function optionalFormString(raw: FormDataEntryValue | null): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

/**
 * BRD §6.2 / Epic 5.10 US-72: toggle the Key Risk Indicator flag on a
 * question. KRI-flagged questions fire an upsell trigger at publish time
 * when answered at maturity ≤ 1.
 */
export async function updatePillarQuestionKriFlag(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const riskAreaId = parseRiskAreaIdFromForm(formData.get("riskAreaId"));
  if (!riskAreaId) {
    redirect(ADMIN_ASSESSMENT_QUESTIONS_PATH);
  }

  let questionId: string;
  try {
    questionId = parsePillarDbUuid(formData.get("questionId"), "questionId");
  } catch {
    redirectAreaSaved(riskAreaId);
  }

  const isKeyRiskIndicator = formData.get("isKeyRiskIndicator") === "true";

  const row = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!row || riskAreaIdForPillarCategory(row.section.category) !== riskAreaId) {
    redirectAreaSaved(riskAreaId);
  }

  await prisma.pillarQuestion.update({
    where: { id: questionId },
    data: { isKeyRiskIndicator },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
    action: AUDIT_ACTIONS.PILLAR_QUESTION_KRI_TOGGLE,
    entityType: "PillarQuestion",
    entityId: row.id,
    beforeData: { isKeyRiskIndicator: row.isKeyRiskIndicator },
    afterData: { isKeyRiskIndicator },
    metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
  });

  revalidateQuestionBankPaths(riskAreaId);
  redirectAreaSaved(riskAreaId);
}

export async function updatePillarQuestionVisibility(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const riskAreaId = parseRiskAreaIdFromForm(formData.get("riskAreaId"));
  if (!riskAreaId) {
    redirect(ADMIN_ASSESSMENT_QUESTIONS_PATH);
  }

  let questionId: string;
  try {
    questionId = parsePillarDbUuid(formData.get("questionId"), "questionId");
  } catch {
    redirectAreaSaved(riskAreaId);
  }

  const isVisible = formData.get("isVisible") === "true";

  const row = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!row || riskAreaIdForPillarCategory(row.section.category) !== riskAreaId) {
    redirectAreaSaved(riskAreaId);
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
  redirectAreaSaved(riskAreaId);
}

export async function deletePillarQuestion(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const riskAreaId = parseRiskAreaIdFromForm(formData.get("riskAreaId"));
  if (!riskAreaId) {
    redirect(ADMIN_ASSESSMENT_QUESTIONS_PATH);
  }

  let questionId: string;
  try {
    questionId = parsePillarDbUuid(formData.get("questionId"), "questionId");
  } catch {
    redirect(adminAssessmentQuestionsAreaPath(riskAreaId));
  }

  const row = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!row || riskAreaIdForPillarCategory(row.section.category) !== riskAreaId) {
    redirect(adminAssessmentQuestionsAreaPath(riskAreaId));
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
    metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
  });

  revalidateQuestionBankPaths(riskAreaId);
  redirect(adminAssessmentQuestionsAreaPath(riskAreaId));
}

export async function updatePillarQuestionContent(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  let questionId: string;
  let riskAreaId: string;
  try {
    questionId = parsePillarDbUuid(formData.get("questionId"), "questionId");
    const riskAreaIdRaw = formData.get("riskAreaId");
    if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
      throw new Error("Invalid risk area.");
    }
    riskAreaId = riskAreaIdRaw;

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
    const isKeyRiskIndicator = formData.has("isKeyRiskIndicator");

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
        isKeyRiskIndicator,
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
        isKeyRiskIndicator: existing.isKeyRiskIndicator,
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
        isKeyRiskIndicator,
      },
      metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
    });
  } catch (e: unknown) {
    redirectUpdateError(formData, formatActionError(e));
  }

  revalidateQuestionBankPaths(riskAreaId);
  redirect(`${adminAssessmentQuestionsEditPath(riskAreaId, questionId)}?saved=1`);
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

    const sectionId = pillarDbUuidSchema.parse(formData.get("sectionId"));
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
    const isKeyRiskIndicator = formData.has("isKeyRiskIndicator");

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
        isKeyRiskIndicator,
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
        isKeyRiskIndicator: created.isKeyRiskIndicator,
      },
      metadata: { riskAreaId, categoryKind: "ASSESSMENT" },
    });
  } catch (e: unknown) {
    redirectCreateError(formData, formatActionError(e));
  }

  revalidateQuestionBankPaths(riskAreaId);
  redirect(`${adminAssessmentQuestionsAreaPath(riskAreaId)}?saved=1`);
}

export async function movePillarQuestionOrder(formData: FormData) {
  const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
  const riskAreaId = parseRiskAreaIdFromForm(formData.get("riskAreaId"));
  if (!riskAreaId) {
    redirect(ADMIN_ASSESSMENT_QUESTIONS_PATH);
  }

  let questionId: string;
  let direction: "up" | "down";
  try {
    questionId = parsePillarDbUuid(formData.get("questionId"), "questionId");
    direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  } catch {
    redirectAreaSaved(riskAreaId);
  }

  const before = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    include: { section: { include: { category: true } } },
  });
  if (!before || riskAreaIdForPillarCategory(before.section.category) !== riskAreaId) {
    redirectAreaSaved(riskAreaId);
  }

  const result = await reorderPillarQuestionInRiskArea({
    riskAreaId,
    questionId,
    direction,
  });
  if (!result.ok) {
    redirectAreaSaved(riskAreaId);
  }

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
      categoryKind: "ASSESSMENT",
      swappedWithId: result.swappedWithId,
    },
  });

  revalidateQuestionBankPaths(riskAreaId);
  redirectAreaSaved(riskAreaId);
}
