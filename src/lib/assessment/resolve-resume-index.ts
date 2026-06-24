import { getVisibleQuestions } from "@/lib/assessment/branching";
import type { HouseholdProfile } from "@/lib/assessment/personalization";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import type { ServerAssessmentData } from "@/lib/assessment/store";
import type { Question } from "@/lib/assessment/types";

export function isQuestionAnsweredForResume(
  questionId: string,
  answers: Record<string, unknown>,
  skippedQuestions: string[],
): boolean {
  if (skippedQuestions.includes(questionId)) return true;
  const answer = answers[questionId];
  return answer !== undefined && answer !== null;
}

export function firstUnansweredQuestionIndex(
  visibleQuestions: Question[],
  answers: Record<string, unknown>,
  skippedQuestions: string[],
): number {
  if (visibleQuestions.length === 0) return 0;
  const idx = visibleQuestions.findIndex(
    (q) => !isQuestionAnsweredForResume(q.id, answers, skippedQuestions),
  );
  return idx === -1 ? visibleQuestions.length - 1 : idx;
}

export type ResumeIndexInput = {
  assessmentData?: Pick<
    ServerAssessmentData,
    "currentPillar" | "currentQuestionIndex"
  > | null;
  storePillar?: string | null;
  storeIndex?: number;
  visibleQuestions: Question[];
  answers: Record<string, unknown>;
  skippedQuestions: string[];
};

function clampIndex(index: number, visibleQuestions: Question[]): number {
  if (visibleQuestions.length === 0) return 0;
  return Math.min(Math.max(0, index), visibleQuestions.length - 1);
}

function advanceIfAnswered(
  index: number,
  visibleQuestions: Question[],
  answers: Record<string, unknown>,
  skippedQuestions: string[],
): number {
  const clamped = clampIndex(index, visibleQuestions);
  const question = visibleQuestions[clamped];
  if (
    question &&
    isQuestionAnsweredForResume(question.id, answers, skippedQuestions)
  ) {
    return firstUnansweredQuestionIndex(
      visibleQuestions,
      answers,
      skippedQuestions,
    );
  }
  return clamped;
}

/** Resume at the saved server/store position, or the first unanswered visible question. */
export function resolveResumeQuestionIndex(
  pillarSlug: string,
  input: ResumeIndexInput,
): number {
  const slug = normalizePillarSlug(pillarSlug);
  const serverPillar = input.assessmentData?.currentPillar
    ? normalizePillarSlug(input.assessmentData.currentPillar)
    : null;
  const serverIndex =
    typeof input.assessmentData?.currentQuestionIndex === "number"
      ? input.assessmentData.currentQuestionIndex
      : null;

  if (serverPillar === slug && serverIndex != null && serverIndex >= 0) {
    return advanceIfAnswered(
      serverIndex,
      input.visibleQuestions,
      input.answers,
      input.skippedQuestions,
    );
  }

  if (
    input.storePillar &&
    normalizePillarSlug(input.storePillar) === slug &&
    input.storeIndex != null &&
    input.storeIndex >= 0
  ) {
    return advanceIfAnswered(
      input.storeIndex,
      input.visibleQuestions,
      input.answers,
      input.skippedQuestions,
    );
  }

  return firstUnansweredQuestionIndex(
    input.visibleQuestions,
    input.answers,
    input.skippedQuestions,
  );
}

export function resolveResumePillarSlug(
  pillars: Array<{
    slug: string;
    status: "not-started" | "in-progress" | "completed";
  }>,
  assessmentData?: Pick<ServerAssessmentData, "currentPillar"> | null,
  storePillar?: string | null,
): string | null {
  const inProgress = pillars.find((p) => p.status === "in-progress");
  if (inProgress) return inProgress.slug;

  const serverPillar = assessmentData?.currentPillar
    ? normalizePillarSlug(assessmentData.currentPillar)
    : null;
  if (serverPillar) {
    const match = pillars.find((p) => p.slug === serverPillar);
    if (match && match.status !== "completed") return serverPillar;
  }

  if (storePillar) {
    const normalized = normalizePillarSlug(storePillar);
    const match = pillars.find((p) => p.slug === normalized);
    if (match && match.status !== "completed") return normalized;
  }

  const next = pillars.find((p) => p.status === "not-started");
  return next?.slug ?? null;
}

export function buildResumeIndexInput(
  pillarSlug: string,
  questions: Question[],
  householdProfile: HouseholdProfile | null,
  store: {
    answers: Record<string, unknown>;
    skippedQuestions: string[];
    currentPillar: string | null;
    currentQuestionIndex: number;
  },
  assessmentData?: ResumeIndexInput["assessmentData"],
): ResumeIndexInput {
  const visibleQuestions = getVisibleQuestions(
    store.answers,
    questions,
    householdProfile,
  );
  return {
    assessmentData,
    storePillar: store.currentPillar,
    storeIndex: store.currentQuestionIndex,
    visibleQuestions,
    answers: store.answers,
    skippedQuestions: store.skippedQuestions,
  };
}

export function resolveResumeQuestionIndexForPillar(
  pillarSlug: string,
  questions: Question[],
  householdProfile: HouseholdProfile | null,
  store: {
    answers: Record<string, unknown>;
    skippedQuestions: string[];
    currentPillar: string | null;
    currentQuestionIndex: number;
  },
  assessmentData?: ResumeIndexInput["assessmentData"],
): number {
  const input = buildResumeIndexInput(
    pillarSlug,
    questions,
    householdProfile,
    store,
    assessmentData,
  );
  return resolveResumeQuestionIndex(pillarSlug, input);
}
