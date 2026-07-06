/**
 * Test-only helpers for methodology snapshot integrity checks.
 */
import "server-only";

import { AdvisorQuestionSource, Prisma } from "@prisma/client";
import {
  canDeleteAdvisorQuestion,
  deleteAdvisorQuestionError,
  nextDisplayOrder,
} from "@/lib/methodology/advisor-question-policy";
import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";
import {
  createIntakeInterview,
  getActiveIntakeInterview,
  saveIntakeResponse,
  updateInterviewProgress,
} from "@/lib/data/intake";
import { decryptTranscription } from "@/lib/data/response-content";
import { loadIntakeScriptForInterview } from "@/lib/intake/load-intake-script";
import { formatIntakeAnswerDisplay } from "@/lib/pdf/intake/format-intake-answer";
import {
  getAssignedAdvisorProfileIdForClient,
  loadSnapshotForInterview,
  writeIntakeSnapshot,
} from "@/lib/methodology/snapshot";
import { recommendationRulesFromSnapshot } from "@/lib/methodology/snapshot-helpers";
import { defaultCustomRecommendationConditions } from "@/lib/methodology/advisor-recommendation-starter";
import {
  resolvePillarNarrativesForAssessment,
  resolvePillarConfigForAssessment,
  resolveThresholdsForAssessmentPillar,
} from "@/lib/methodology/assessment-runtime";
import { loadAssessmentAnswersForQuestions } from "@/lib/assessment/pillar-answer-loader";
import { calculatePillarScore } from "@/lib/assessment/scoring";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { encryptAnswer } from "@/lib/data/response-content";

export async function resetClientIntake(clientEmail: string): Promise<void> {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);
  await prisma.intakeInterview.deleteMany({ where: { userId: user.id } });
}

export async function startIntakeSnapshotForClient(clientEmail: string) {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);

  let interview = await getActiveIntakeInterview(user.id);
  if (!interview) {
    interview = await createIntakeInterview(user.id);
  }

  const advisorId = await getAssignedAdvisorProfileIdForClient(user.id);
  if (!advisorId) {
    throw new Error(`No active advisor assignment for ${clientEmail}`);
  }

  await writeIntakeSnapshot(interview.id, advisorId);
  await updateInterviewProgress(interview.id, 0, "IN_PROGRESS");

  const script = await loadIntakeScriptForInterview(interview.id);
  return {
    interviewId: interview.id,
    advisorProfileId: advisorId,
    questions: script.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      answerType: q.answerType,
      options: q.options ?? null,
    })),
  };
}

export async function getSnapshottedIntakeScriptForClient(clientEmail: string) {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);
  const interview = await getActiveIntakeInterview(user.id);
  if (!interview) throw new Error("No active intake interview");
  const script = await loadIntakeScriptForInterview(interview.id);
  return {
    interviewId: interview.id,
    questions: script.map((q) => ({ id: q.id, questionText: q.questionText })),
  };
}

export async function patchAdvisorIntakeQuestionByEmail(
  advisorEmail: string,
  questionId: string,
  questionText: string,
) {
  const advisorUser = await findUserByEmail(advisorEmail.trim().toLowerCase());
  if (!advisorUser) throw new Error(`Advisor not found: ${advisorEmail}`);
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUser.id },
  });
  if (!profile) throw new Error("Advisor profile not found");

  const row = await prisma.advisorIntakeQuestion.findFirst({
    where: { id: questionId, advisorProfileId: profile.id },
  });
  if (!row) throw new Error("Advisor intake question not found");

  await prisma.advisorIntakeQuestion.update({
    where: { id: questionId },
    data: { questionText, version: { increment: 1 } },
  });
}

export async function ensureAssessmentWithSnapshot(clientEmail: string, pillar = "governance") {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);

  let assessment = await prisma.assessment.findFirst({
    where: { userId: user.id, status: "IN_PROGRESS" },
    orderBy: { updatedAt: "desc" },
  });
  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: { userId: user.id, status: "IN_PROGRESS" },
    });
  }

  const interview = await prisma.intakeInterview.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { snapshot: true },
  });

  let snapshotId = assessment.snapshotId;
  if (!snapshotId && interview?.snapshot) {
    snapshotId = interview.snapshot.id;
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { snapshotId },
    });
  } else if (!snapshotId) {
    const advisorId = await getAssignedAdvisorProfileIdForClient(user.id);
    if (!advisorId) throw new Error("No advisor assignment");
    let interviewId = interview?.id;
    if (!interviewId) {
      const created = await createIntakeInterview(user.id);
      interviewId = created.id;
      await updateInterviewProgress(interviewId, 0, "IN_PROGRESS");
    }
    const snap = await writeIntakeSnapshot(interviewId, advisorId);
    snapshotId = snap.snapshotId;
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { snapshotId },
    });
  }

  const pillarSlug = normalizePillarSlug(pillar);
  const config = await resolvePillarConfigForAssessment(assessment.id, pillarSlug);
  if (!config || config.questions.length === 0) {
    throw new Error(`No questions for pillar ${pillarSlug}`);
  }

  const maturityAnswer = 0;
  for (const q of config.questions) {
    await prisma.assessmentResponse.upsert({
      where: {
        assessmentId_questionId: {
          assessmentId: assessment.id,
          questionId: q.id,
        },
      },
      create: {
        assessmentId: assessment.id,
        questionId: q.id,
        pillar: q.subCategory ?? pillarSlug,
        subCategory: q.subCategory ?? pillarSlug,
        answer: encryptAnswer(maturityAnswer),
        skipped: false,
      },
      update: {
        answer: encryptAnswer(maturityAnswer),
        skipped: false,
      },
    });
  }

  const answers: Record<string, unknown> = {};
  for (const q of config.questions) {
    answers[q.id] = maturityAnswer;
  }
  const visible = getVisibleQuestions(answers, config.questions);
  const thresholds = await resolveThresholdsForAssessmentPillar(assessment.id, pillarSlug);
  const scoreResult = calculatePillarScore(
    answers,
    config.pillarData,
    config.questions,
    visible.map((q) => q.id),
    thresholds,
  );

  await prisma.pillarScore.upsert({
    where: {
      assessmentId_pillar: { assessmentId: assessment.id, pillar: pillarSlug },
    },
    create: {
      assessmentId: assessment.id,
      pillar: pillarSlug,
      score: scoreResult.score,
      riskLevel: scoreResult.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
      missingControls:
        (scoreResult.missingControls ?? null) as unknown as Prisma.InputJsonValue,
    },
    update: {
      score: scoreResult.score,
      riskLevel: scoreResult.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
      missingControls:
        (scoreResult.missingControls ?? null) as unknown as Prisma.InputJsonValue,
    },
  });

  return { assessmentId: assessment.id, snapshotId, pillar: pillarSlug };
}

export async function getPinnedPillarNarratives(
  assessmentId: string,
  pillar: string,
): Promise<string[]> {
  const score = await prisma.pillarScore.findUnique({
    where: {
      assessmentId_pillar: {
        assessmentId,
        pillar: normalizePillarSlug(pillar),
      },
    },
  });
  if (!score) throw new Error("Pillar not scored");

  const config = await resolvePillarConfigForAssessment(assessmentId, pillar);
  const questionIds = config?.questions.map((q) => q.id) ?? [];
  const answers = await loadAssessmentAnswersForQuestions(assessmentId, questionIds);

  return resolvePillarNarrativesForAssessment(
    assessmentId,
    pillar,
    score.score,
    score.riskLevel,
    answers,
  );
}

export async function patchAdvisorNarrativeByEmail(
  advisorEmail: string,
  pillarSlug: string,
  allNegative: string[],
) {
  const advisorUser = await findUserByEmail(advisorEmail.trim().toLowerCase());
  if (!advisorUser) throw new Error(`Advisor not found: ${advisorEmail}`);
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUser.id },
  });
  if (!profile) throw new Error("Advisor profile not found");

  const pillar = await prisma.pillar.findUnique({
    where: { slug: normalizePillarSlug(pillarSlug) },
  });
  if (!pillar) throw new Error("Pillar not found");

  const existing = await prisma.advisorPillarNarrative.findUnique({
    where: {
      advisorProfileId_pillarId: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
      },
    },
  });

  const midBand = (existing?.midBand as object) ?? {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  await prisma.advisorPillarNarrative.upsert({
    where: {
      advisorProfileId_pillarId: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
      },
    },
    create: {
      advisorProfileId: profile.id,
      pillarId: pillar.id,
      allNegative,
      allYes: (existing?.allYes as string[]) ?? [],
      midBand,
    },
    update: {
      allNegative,
      version: { increment: 1 },
    },
  });
}

async function advisorProfileForEmail(advisorEmail: string) {
  const advisorUser = await findUserByEmail(advisorEmail.trim().toLowerCase());
  if (!advisorUser) throw new Error(`Advisor not found: ${advisorEmail}`);
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUser.id },
  });
  if (!profile) throw new Error("Advisor profile not found");
  return profile;
}

export async function createCustomIntakeQuestionForAdvisor(
  advisorEmail: string,
  questionText: string,
) {
  const profile = await advisorProfileForEmail(advisorEmail);
  const siblings = await prisma.advisorIntakeQuestion.findMany({
    where: { advisorProfileId: profile.id },
    select: { displayOrder: true },
  });
  const order = nextDisplayOrder(siblings);
  const row = await prisma.advisorIntakeQuestion.create({
    data: {
      advisorProfileId: profile.id,
      sourceKind: AdvisorQuestionSource.CUSTOM,
      displayOrder: order,
      questionNumber: String(order + 1),
      questionText,
      answerType: "audio",
      isVisible: true,
    },
  });
  return { questionId: row.id, questionText: row.questionText };
}

export async function createCustomChoiceListIntakeForAdvisor(
  advisorEmail: string,
  questionText: string,
  optionLabels: string[],
) {
  const profile = await advisorProfileForEmail(advisorEmail);
  const siblings = await prisma.advisorIntakeQuestion.findMany({
    where: { advisorProfileId: profile.id },
    select: { displayOrder: true },
  });
  const order = nextDisplayOrder(siblings);
  const options = optionLabels.map((label, index) => ({
    value: String(index),
    label,
  }));
  const row = await prisma.advisorIntakeQuestion.create({
    data: {
      advisorProfileId: profile.id,
      sourceKind: AdvisorQuestionSource.CUSTOM,
      displayOrder: order,
      questionNumber: String(order + 1),
      questionText,
      answerType: "choice_list",
      options,
      isVisible: true,
    },
  });
  return {
    questionId: row.id,
    questionText: row.questionText,
    answerType: row.answerType,
    options,
  };
}

export async function recordIntakeStructuredAnswer(
  clientEmail: string,
  questionId: string,
  value: string,
) {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);
  const interview = await getActiveIntakeInterview(user.id);
  if (!interview) throw new Error("No active intake interview");
  await saveIntakeResponse(interview.id, questionId, {
    transcription: value,
    transcriptionStatus: "COMPLETED",
  });
}

export async function getFormattedIntakeAnswerForClient(
  clientEmail: string,
  questionId: string,
) {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);
  const interview = await getActiveIntakeInterview(user.id);
  if (!interview) throw new Error("No active intake interview");

  const script = await loadIntakeScriptForInterview(interview.id);
  const question = script.find((entry) => entry.id === questionId);
  if (!question) throw new Error("Question not found in intake script");

  const response = await prisma.intakeResponse.findUnique({
    where: {
      interviewId_questionId: {
        interviewId: interview.id,
        questionId,
      },
    },
    select: {
      transcription: true,
      audioUrl: true,
      transcriptionStatus: true,
    },
  });

  const formatted = formatIntakeAnswerDisplay(
    response
      ? {
          transcription: response.transcription
            ? decryptTranscription(response.transcription)
            : null,
          audioUrl: response.audioUrl,
          transcriptionStatus: response.transcriptionStatus,
        }
      : undefined,
    question,
  );

  return {
    answerText: formatted.answerText,
    answerKind: formatted.answerKind,
    answerLabel: formatted.answerLabel,
  };
}

export async function hideAdvisorIntakeQuestion(
  advisorEmail: string,
  questionId: string,
) {
  const profile = await advisorProfileForEmail(advisorEmail);
  const row = await prisma.advisorIntakeQuestion.findFirst({
    where: { id: questionId, advisorProfileId: profile.id },
  });
  if (!row) throw new Error("Advisor intake question not found");
  await prisma.advisorIntakeQuestion.update({
    where: { id: questionId },
    data: { isVisible: false, version: { increment: 1 } },
  });
}

export async function tryDeleteAdvisorIntakeQuestion(
  advisorEmail: string,
  questionId: string,
): Promise<{ deleted: boolean; error?: string }> {
  const profile = await advisorProfileForEmail(advisorEmail);
  const row = await prisma.advisorIntakeQuestion.findFirst({
    where: { id: questionId, advisorProfileId: profile.id },
  });
  if (!row) return { deleted: false, error: "Question not found" };
  if (!canDeleteAdvisorQuestion(row.sourceKind)) {
    return { deleted: false, error: deleteAdvisorQuestionError() };
  }
  await prisma.advisorIntakeQuestion.delete({ where: { id: questionId } });
  return { deleted: true };
}

export async function createCustomRecommendationRuleForAdvisor(
  advisorEmail: string,
  pillarSlug: string,
  name: string,
  serviceRecommendationId?: string,
) {
  const profile = await advisorProfileForEmail(advisorEmail);
  const slug = normalizePillarSlug(pillarSlug);
  const pillar = await prisma.pillar.findUnique({ where: { slug } });
  if (!pillar) throw new Error("Pillar not found");

  let serviceId = serviceRecommendationId?.trim();
  if (!serviceId) {
    const fallback = await prisma.serviceRecommendation.findFirst({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });
    if (!fallback) throw new Error("No active service recommendations");
    serviceId = fallback.id;
  }

  const row = await prisma.advisorRecommendationRule.create({
    data: {
      advisorProfileId: profile.id,
      pillarId: pillar.id,
      sourceKind: AdvisorQuestionSource.CUSTOM,
      name,
      triggerConditions: defaultCustomRecommendationConditions(
        slug,
      ) as unknown as Prisma.InputJsonValue,
      servicePayload: {
        serviceRecommendationId: serviceId,
        serviceId,
      },
      priority: 10,
      isActive: true,
    },
  });
  return { ruleId: row.id, name: row.name };
}

export async function deactivateAdvisorRecommendationRule(
  advisorEmail: string,
  ruleId: string,
) {
  const profile = await advisorProfileForEmail(advisorEmail);
  const row = await prisma.advisorRecommendationRule.findFirst({
    where: { id: ruleId, advisorProfileId: profile.id },
  });
  if (!row) throw new Error("Rule not found");
  await prisma.advisorRecommendationRule.update({
    where: { id: ruleId },
    data: { isActive: false, version: { increment: 1 } },
  });
}

export async function tryDeleteAdvisorRecommendationRule(
  advisorEmail: string,
  ruleId: string,
): Promise<{ deleted: boolean; error?: string }> {
  const profile = await advisorProfileForEmail(advisorEmail);
  const row = await prisma.advisorRecommendationRule.findFirst({
    where: { id: ruleId, advisorProfileId: profile.id },
  });
  if (!row) return { deleted: false, error: "Rule not found" };
  if (!canDeleteAdvisorQuestion(row.sourceKind)) {
    return { deleted: false, error: deleteAdvisorQuestionError() };
  }
  await prisma.advisorRecommendationRule.delete({ where: { id: ruleId } });
  return { deleted: true };
}

export async function getSnapshottedRecRulesForClient(clientEmail: string) {
  const user = await findUserByEmail(clientEmail.trim().toLowerCase());
  if (!user) throw new Error(`User not found: ${clientEmail}`);
  const interview = await getActiveIntakeInterview(user.id);
  if (!interview) throw new Error("No active intake interview");
  const snapshot = await loadSnapshotForInterview(interview.id);
  if (!snapshot) throw new Error("No intake snapshot");
  const rules = recommendationRulesFromSnapshot(snapshot);
  return {
    interviewId: interview.id,
    rules: rules.map((r) => ({ id: r.id, serviceId: r.serviceId, priority: r.priority })),
    ruleNames: snapshot.recRules.map((r) => r.name),
  };
}
