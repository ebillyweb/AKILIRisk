"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminRole } from "@/lib/admin/auth";
import { PROFILE_CONDITION_KEYS } from "@/lib/assessment/bank/behaviors";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { isRiskAreaId, RISK_AREA_IDS } from "@/lib/assessment/bank/risk-areas";
import type { QuestionType } from "@/lib/assessment/types";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const QUESTION_TYPES = [
  "single-choice",
  "yes-no",
  "maturity-scale",
  "likert",
  "numeric",
  "short-text",
] as const satisfies readonly QuestionType[];

const optionSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string(),
  description: z.string().optional(),
});

const branchingPredicateSchema = z.object({
  op: z.enum(["equals", "notEquals"]),
  value: z.unknown(),
});

function revalidateQuestionBankPaths(riskAreaId?: string) {
  revalidatePath("/admin/question-bank");
  revalidatePath("/admin/question-bank", "layout");
  if (riskAreaId) {
    revalidatePath(`/admin/question-bank/${riskAreaId}`);
  }
  revalidatePath("/advisor/question-bank");
  revalidatePath("/advisor/question-bank", "layout");
}

function parseScoreMapJson(raw: string): Prisma.InputJsonValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Score map must be valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Score map must be a JSON object.");
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isNaN(n)) {
      throw new Error(`Score map value for "${k}" must be a number.`);
    }
    out[String(k)] = n;
  }
  return out as Prisma.InputJsonValue;
}

function parseOptionsJson(
  raw: string | null | undefined,
  type: QuestionType
): Prisma.InputJsonValue | undefined {
  // `likert` shares numeric/short-text's "options optional" stance — the
  // five anchors are baked into the LikertScale renderer; admins can leave
  // the JSON blank and rely on the default copy.
  if (type === "numeric" || type === "short-text" || type === "likert") {
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      return undefined;
    }
  }
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    if (type === "single-choice" || type === "maturity-scale") {
      throw new Error("Options JSON is required for this question type.");
    }
    if (type === "yes-no") {
      return [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ] as Prisma.InputJsonValue;
    }
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw new Error("Options must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Options must be a JSON array.");
  }
  return z.array(optionSchema).parse(parsed) as Prisma.InputJsonValue;
}

function parseBranchingPredicate(
  raw: string | null | undefined
): Prisma.InputJsonValue | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  try {
    const parsed = JSON.parse(String(raw));
    return branchingPredicateSchema.parse(parsed) as Prisma.InputJsonValue;
  } catch {
    throw new Error("Branching predicate must be valid JSON like {\"op\":\"equals\",\"value\":\"yes\"}.");
  }
}

function defaultScoreMapForType(type: QuestionType): Prisma.InputJsonValue {
  switch (type) {
    case "yes-no":
      return { yes: 3, no: 0 };
    case "maturity-scale":
      return { 0: 0, 1: 1, 2: 2, 3: 3 };
    case "likert":
      // 5-point Likert default: 1→1 … 5→5. Negatively-keyed items can be
      // re-authored with the inverted map (5→1, 1→5) without touching
      // the renderer.
      return { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
    default:
      return {};
  }
}

function assertScoreMapUsable(type: QuestionType, scoreMap: Prisma.InputJsonValue) {
  const keys = Object.keys(scoreMap as object);
  if (
    (type === "single-choice" || type === "numeric" || type === "short-text") &&
    keys.length === 0
  ) {
    throw new Error("Provide a score map JSON object for this question type (keys must match answer values).");
  }
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

const profileConditionKeySchema = z.enum(PROFILE_CONDITION_KEYS);

type RiskAreaId = (typeof RISK_AREA_IDS)[number];

function buildAssessmentBankCreateData(
  formData: FormData,
  riskAreaId: RiskAreaId,
): Omit<Prisma.AssessmentBankQuestionCreateInput, "sortOrderGlobal"> {
  const text = z.string().min(1).parse(formData.get("text"));
  const helpTextRaw = formData.get("helpText");
  const learnMoreRaw = formData.get("learnMore");
  const helpText =
    helpTextRaw === null || helpTextRaw === "" ? null : String(helpTextRaw);
  const learnMore =
    learnMoreRaw === null || learnMoreRaw === "" ? null : String(learnMoreRaw);
  const riskRelevanceRaw = formData.get("riskRelevance");
  const riskRelevance =
    riskRelevanceRaw === null || riskRelevanceRaw === "" ? null : String(riskRelevanceRaw);
  const weight = z.coerce.number().int().min(0).max(100).parse(formData.get("weight"));
  const required = formData.has("required");
  const type = z.enum(QUESTION_TYPES).parse(formData.get("type"));
  const isVisible = formData.has("isVisible");

  const scoreMapRaw = formData.get("scoreMapJson");
  const scoreMap =
    scoreMapRaw !== null && String(scoreMapRaw).trim() !== ""
      ? parseScoreMapJson(String(scoreMapRaw))
      : (defaultScoreMapForType(type) as Prisma.InputJsonValue);

  assertScoreMapUsable(type, scoreMap);

  const parsedOptions = parseOptionsJson(
    formData.get("optionsJson") === null || formData.get("optionsJson") === ""
      ? null
      : String(formData.get("optionsJson")),
    type
  );

  const branchingDependsOnRaw = formData.get("branchingDependsOn");
  const branchingDependsOn =
    branchingDependsOnRaw === null || String(branchingDependsOnRaw).trim() === ""
      ? null
      : String(branchingDependsOnRaw).trim();

  const branchingPredicate = parseBranchingPredicate(
    formData.get("branchingPredicateJson") === null
      ? undefined
      : String(formData.get("branchingPredicateJson"))
  );

  const profileKeyRaw = formData.get("profileConditionKey");
  const profileConditionKey =
    profileKeyRaw === null || String(profileKeyRaw).trim() === ""
      ? null
      : profileConditionKeySchema.parse(String(profileKeyRaw));

  const omitMaturityScoreWhenYes = formData.has("omitMaturityScoreWhenYes");

  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const questionId = `custom-${riskAreaId.slice(0, 8)}-${suffix}`;

  return {
    questionId,
    riskAreaId,
    isVisible,
    text,
    helpText,
    learnMore,
    riskRelevance,
    type,
    options:
      parsedOptions === undefined ? Prisma.DbNull : (parsedOptions as Prisma.InputJsonValue),
    required,
    weight,
    scoreMap,
    branchingDependsOn,
    branchingPredicate:
      branchingPredicate === null ? Prisma.DbNull : (branchingPredicate as Prisma.InputJsonValue),
    profileConditionKey,
    omitMaturityScoreWhenYes,
  };
}

export async function updateAssessmentBankQuestionVisibility(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
  const questionId = z.string().min(1).parse(formData.get("questionId"));
  const isVisible = formData.get("isVisible") === "true";

  // Capture prior state for audit beforeData. .update returns the post-change
  // row, so we need an explicit read before the write.
  const prior = await prisma.assessmentBankQuestion.findUnique({
    where: { questionId },
    select: { isVisible: true },
  });

  const row = await prisma.assessmentBankQuestion.update({
    where: { questionId },
    data: { isVisible },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
    action: AUDIT_ACTIONS.BANK_QUESTION_VISIBILITY_TOGGLE,
    entityType: "AssessmentBankQuestion",
    entityId: row.id,
    beforeData: { isVisible: prior?.isVisible ?? null },
    afterData: { isVisible },
    metadata: { questionId, riskAreaId: row.riskAreaId },
  });

  revalidateQuestionBankPaths(row.riskAreaId);
}

export async function updatePillarQuestionVisibility(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
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
    actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
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
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
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
    actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
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

function optionalFormString(raw: FormDataEntryValue | null): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export async function updatePillarQuestionContent(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
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
    if (
      riskAreaIdForPillarCategory(existing.section.category) !== riskAreaId
    ) {
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
      actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
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

export async function updateAssessmentBankQuestionContent(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
  try {
    const questionId = z.string().min(1).parse(formData.get("questionId"));
    const text = z.string().min(1).parse(formData.get("text"));
    const helpTextRaw = formData.get("helpText");
    const learnMoreRaw = formData.get("learnMore");
    const helpText =
      helpTextRaw === null || helpTextRaw === "" ? null : String(helpTextRaw);
    const learnMore =
      learnMoreRaw === null || learnMoreRaw === "" ? null : String(learnMoreRaw);
    const riskRelevanceRaw = formData.get("riskRelevance");
    const riskRelevance =
      riskRelevanceRaw === null || riskRelevanceRaw === "" ? null : String(riskRelevanceRaw);
    const weight = z.coerce.number().int().min(0).max(100).parse(formData.get("weight"));
    const required = formData.has("required");
    const type = z.enum(QUESTION_TYPES).parse(formData.get("type"));

    const scoreMapRaw = formData.get("scoreMapJson");
    const scoreMap =
      scoreMapRaw !== null && String(scoreMapRaw).trim() !== ""
        ? parseScoreMapJson(String(scoreMapRaw))
        : (defaultScoreMapForType(type) as Prisma.InputJsonValue);

    assertScoreMapUsable(type, scoreMap);

    const parsedOptions = parseOptionsJson(
      formData.get("optionsJson") === null || formData.get("optionsJson") === ""
        ? null
        : String(formData.get("optionsJson")),
      type
    );

    const branchingDependsOnRaw = formData.get("branchingDependsOn");
    const branchingDependsOn =
      branchingDependsOnRaw === null || String(branchingDependsOnRaw).trim() === ""
        ? null
        : String(branchingDependsOnRaw).trim();

    const branchingPredicate = parseBranchingPredicate(
      formData.get("branchingPredicateJson") === null
        ? undefined
        : String(formData.get("branchingPredicateJson"))
    );

    const profileKeyRaw = formData.get("profileConditionKey");
    const profileConditionKey =
      profileKeyRaw === null || String(profileKeyRaw).trim() === ""
        ? null
        : profileConditionKeySchema.parse(String(profileKeyRaw));

    const omitMaturityScoreWhenYes = formData.has("omitMaturityScoreWhenYes");

    // Capture prior state for audit. .update returns post-change values; we
    // need a fresh read for an honest before/after diff.
    const prior = await prisma.assessmentBankQuestion.findUnique({
      where: { questionId },
    });

    const row = await prisma.assessmentBankQuestion.update({
      where: { questionId },
      data: {
        text,
        helpText,
        learnMore,
        riskRelevance,
        weight,
        required,
        type,
        scoreMap,
        options:
          parsedOptions === undefined
            ? Prisma.DbNull
            : (parsedOptions as Prisma.InputJsonValue),
        branchingDependsOn,
        branchingPredicate:
          branchingPredicate === null
            ? Prisma.DbNull
            : (branchingPredicate as Prisma.InputJsonValue),
        profileConditionKey,
        omitMaturityScoreWhenYes,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
      action: AUDIT_ACTIONS.BANK_QUESTION_UPDATE,
      entityType: "AssessmentBankQuestion",
      entityId: row.id,
      beforeData: prior
        ? {
            text: prior.text,
            helpText: prior.helpText,
            learnMore: prior.learnMore,
            riskRelevance: prior.riskRelevance,
            weight: prior.weight,
            required: prior.required,
            type: prior.type,
            scoreMap: prior.scoreMap,
            options: prior.options,
            branchingDependsOn: prior.branchingDependsOn,
            branchingPredicate: prior.branchingPredicate,
            profileConditionKey: prior.profileConditionKey,
            omitMaturityScoreWhenYes: prior.omitMaturityScoreWhenYes,
          }
        : null,
      afterData: {
        text,
        helpText,
        learnMore,
        riskRelevance,
        weight,
        required,
        type,
        scoreMap,
        options: parsedOptions ?? null,
        branchingDependsOn,
        branchingPredicate,
        profileConditionKey,
        omitMaturityScoreWhenYes,
      },
      metadata: { questionId, riskAreaId: row.riskAreaId },
    });

    revalidateQuestionBankPaths(row.riskAreaId);
  } catch (e: unknown) {
    redirectUpdateError(formData, formatActionError(e));
  }
}

export async function createAssessmentBankQuestion(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
  const riskAreaIdRaw = formData.get("riskAreaId");
  if (typeof riskAreaIdRaw !== "string" || !isRiskAreaId(riskAreaIdRaw)) {
    redirect("/admin/question-bank");
  }
  const riskAreaId = riskAreaIdRaw;

  let createData: Omit<Prisma.AssessmentBankQuestionCreateInput, "sortOrderGlobal">;
  try {
    createData = buildAssessmentBankCreateData(formData, riskAreaId);
  } catch (e: unknown) {
    redirectCreateError(formData, formatActionError(e));
  }

  const maxOrder = await prisma.assessmentBankQuestion.aggregate({
    where: { riskAreaId },
    _max: { sortOrderGlobal: true },
  });
  const sortOrderGlobal = (maxOrder._max.sortOrderGlobal ?? -1) + 1;

  const created = await prisma.assessmentBankQuestion.create({
    data: { ...createData, sortOrderGlobal },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
    action: AUDIT_ACTIONS.BANK_QUESTION_CREATE,
    entityType: "AssessmentBankQuestion",
    entityId: created.id,
    beforeData: null,
    afterData: {
      questionId: created.questionId,
      riskAreaId: created.riskAreaId,
      text: created.text,
      type: created.type,
      weight: created.weight,
      required: created.required,
      isVisible: created.isVisible,
      sortOrderGlobal: created.sortOrderGlobal,
    },
  });

  revalidateQuestionBankPaths(riskAreaId);
  redirect(`/admin/question-bank/${riskAreaId}`);
}

export async function deleteAssessmentBankQuestion(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
  const questionId = z.string().min(1).parse(formData.get("questionId"));

  // .delete returns the deleted row — that gives us the beforeData payload
  // without a separate findUnique.
  const row = await prisma.assessmentBankQuestion.delete({
    where: { questionId },
  });

  await writeAudit({
    actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
    action: AUDIT_ACTIONS.BANK_QUESTION_DELETE,
    entityType: "AssessmentBankQuestion",
    entityId: row.id,
    beforeData: {
      questionId: row.questionId,
      riskAreaId: row.riskAreaId,
      text: row.text,
      type: row.type,
      weight: row.weight,
      isVisible: row.isVisible,
      sortOrderGlobal: row.sortOrderGlobal,
    },
    afterData: null,
  });

  revalidateQuestionBankPaths(row.riskAreaId);
  redirect(`/admin/question-bank/${row.riskAreaId}`);
}

export async function moveAssessmentBankQuestionOrder(formData: FormData) {
  const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
  const questionId = z.string().min(1).parse(formData.get("questionId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));

  const row = await prisma.assessmentBankQuestion.findUnique({
    where: { questionId },
  });
  if (!row) {
    return;
  }

  const list = await prisma.assessmentBankQuestion.findMany({
    where: { riskAreaId: row.riskAreaId },
    orderBy: { sortOrderGlobal: "asc" },
    select: { id: true, questionId: true, sortOrderGlobal: true },
  });

  const idx = list.findIndex((q) => q.questionId === questionId);
  if (idx < 0) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return;

  const a = list[idx]!;
  const b = list[swapWith]!;

  await prisma.$transaction([
    prisma.assessmentBankQuestion.update({
      where: { id: a.id },
      data: { sortOrderGlobal: b.sortOrderGlobal },
    }),
    prisma.assessmentBankQuestion.update({
      where: { id: b.id },
      data: { sortOrderGlobal: a.sortOrderGlobal },
    }),
  ]);

  // One audit row per reorder action, scoped to the question that the admin
  // explicitly moved. The swapped neighbor is captured in metadata.
  await writeAudit({
    actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
    action: AUDIT_ACTIONS.BANK_QUESTION_REORDER,
    entityType: "AssessmentBankQuestion",
    entityId: a.id,
    beforeData: { sortOrderGlobal: a.sortOrderGlobal },
    afterData: { sortOrderGlobal: b.sortOrderGlobal },
    metadata: {
      questionId,
      direction,
      riskAreaId: row.riskAreaId,
      swappedWith: { id: b.id, questionId: b.questionId },
    },
  });

  revalidateQuestionBankPaths(row.riskAreaId);
}
