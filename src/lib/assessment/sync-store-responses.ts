import {
  assessmentPillarDefinitions,
  normalizePillarSlug,
} from "@/lib/assessment/pillar-registry";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";
import type { Question } from "@/lib/assessment/types";

type SyncInput = {
  answers: Record<string, unknown>;
  skippedQuestions: string[];
  questionBank: Question[];
  currentPillar: string | null;
};

async function fetchPillarQuestions(pillarSlug: string): Promise<Question[]> {
  const normalized = normalizePillarSlug(pillarSlug);
  const response = await fetch(`/api/assessment/pillars/${normalized}/questions`);
  if (!response.ok) return [];
  const data = (await response.json()) as { questions?: Question[] };
  return data.questions ?? [];
}

async function resolveQuestionBank(
  questionBank: Question[],
  currentPillar: string | null
): Promise<Question[]> {
  if (questionBank.length > 0) return questionBank;

  const pillarsWithAnswers = new Set<string>();
  if (currentPillar) pillarsWithAnswers.add(normalizePillarSlug(currentPillar));

  let catalog = starterPillarCatalog();
  try {
    const response = await fetch("/api/platform/pillars");
    if (response.ok) {
      catalog = await response.json();
    }
  } catch {
    // fallback to starter catalog
  }

  for (const pillar of assessmentPillarDefinitions(catalog)) {
    pillarsWithAnswers.add(pillar.slug);
  }

  const loaded = await Promise.all(
    [...pillarsWithAnswers].map((slug) => fetchPillarQuestions(slug))
  );
  return loaded.flat();
}

/** Persist in-memory assessment answers before scoring (server reads DB only). */
export async function syncStoreAnswersToServer(
  assessmentId: string,
  input: SyncInput,
  options?: { facilitatedSessionId?: string },
): Promise<{ syncedCount: number }> {
  const { answers, skippedQuestions, currentPillar } = input;
  const questionBank = await resolveQuestionBank(
    input.questionBank,
    currentPillar
  );
  if (questionBank.length === 0) {
    throw new Error("Could not load assessment questions to save your answers.");
  }

  const questionsById = new Map(questionBank.map((q) => [q.id, q]));

  const saves: Array<{
    questionId: string;
    pillar: string;
    subCategory: string;
    answer: unknown;
    skipped: boolean;
  }> = [];

  for (const [questionId, answer] of Object.entries(answers)) {
    const question = questionsById.get(questionId);
    if (!question) continue;
    saves.push({
      questionId,
      pillar: question.pillar,
      subCategory: question.subCategory,
      answer,
      skipped: false,
    });
  }

  for (const questionId of skippedQuestions) {
    if (answers[questionId] !== undefined) continue;
    const question = questionsById.get(questionId);
    if (!question) continue;
    saves.push({
      questionId,
      pillar: question.pillar,
      subCategory: question.subCategory,
      answer: null,
      skipped: true,
    });
  }

  if (saves.length === 0) {
    throw new Error(
      "No saved answers found in this browser session. Return to the assessment and re-answer your questions."
    );
  }

  for (const payload of saves) {
    const response = await fetch(`/api/assessment/${assessmentId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        currentPillar: currentPillar ?? payload.pillar,
        ...(options?.facilitatedSessionId
          ? { facilitatedSessionId: options.facilitatedSessionId }
          : {}),
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        (error as { error?: string }).error ?? "Failed to sync assessment answers"
      );
    }
  }

  return { syncedCount: saves.length };
}
