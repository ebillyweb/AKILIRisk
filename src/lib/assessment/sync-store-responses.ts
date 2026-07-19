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
  /** When set, only sync answers for these pillars (assessment scope). */
  includedPillars?: string[] | null;
};

type SyncOptions = {
  facilitatedSessionId?: string;
};

async function fetchPillarQuestions(pillarSlug: string): Promise<Question[]> {
  const normalized = normalizePillarSlug(pillarSlug);
  const response = await fetch(`/api/assessment/risk-domains/${normalized}/questions`);
  if (!response.ok) return [];
  const data = (await response.json()) as { questions?: Question[] };
  return data.questions ?? [];
}

/** Pillars to load when the in-memory bank is empty. Prefer current + scope over full catalog. */
export function pillarsToLoadForSync(input: {
  currentPillar: string | null;
  includedPillars?: string[] | null;
  catalogSlugs: readonly string[];
}): string[] {
  const { currentPillar, includedPillars, catalogSlugs } = input;
  const pillars = new Set<string>();

  if (currentPillar) {
    pillars.add(normalizePillarSlug(currentPillar));
  }

  if (includedPillars?.length) {
    for (const id of includedPillars) {
      pillars.add(normalizePillarSlug(id));
    }
    return [...pillars];
  }

  // Completing a single pillar: do not pull the full catalog (out-of-scope
  // store answers would otherwise be matched and rejected by the API).
  if (currentPillar) {
    return [...pillars];
  }

  return catalogSlugs.map((slug) => normalizePillarSlug(slug));
}

/** Drop answers outside assessment scope / the pillar being completed. */
export function filterSyncPayloads<T extends { pillar: string }>(
  payloads: T[],
  input: { currentPillar: string | null; includedPillars?: string[] | null },
): T[] {
  const { currentPillar, includedPillars } = input;

  if (includedPillars?.length) {
    const scope = new Set(includedPillars.map((id) => normalizePillarSlug(id)));
    return payloads.filter((p) => scope.has(normalizePillarSlug(p.pillar)));
  }

  if (currentPillar) {
    const target = normalizePillarSlug(currentPillar);
    return payloads.filter((p) => normalizePillarSlug(p.pillar) === target);
  }

  return payloads;
}

async function resolveQuestionBank(
  questionBank: Question[],
  currentPillar: string | null,
  includedPillars?: string[] | null,
): Promise<Question[]> {
  if (questionBank.length > 0) return questionBank;

  let catalog = starterPillarCatalog();
  try {
    const response = await fetch("/api/platform/risk-domains");
    if (response.ok) {
      catalog = await response.json();
    }
  } catch {
    // fallback to starter catalog
  }

  const catalogSlugs = assessmentPillarDefinitions(catalog).map((p) => p.slug);
  const pillarsWithAnswers = pillarsToLoadForSync({
    currentPillar,
    includedPillars,
    catalogSlugs,
  });

  const loaded = await Promise.all(
    pillarsWithAnswers.map((slug) => fetchPillarQuestions(slug)),
  );
  return loaded.flat();
}

/** Persist in-memory assessment answers before scoring (server reads DB only). */
export async function syncStoreAnswersToServer(
  assessmentId: string,
  input: SyncInput,
  options?: SyncOptions,
): Promise<{ syncedCount: number; skippedOutOfScope: number }> {
  const { answers, skippedQuestions, currentPillar, includedPillars } = input;
  const questionBank = await resolveQuestionBank(
    input.questionBank,
    currentPillar,
    includedPillars,
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

  const scopedSaves = filterSyncPayloads(saves, { currentPillar, includedPillars });
  const skippedOutOfScope = saves.length - scopedSaves.length;

  if (scopedSaves.length === 0) {
    throw new Error(
      "No saved answers found in this browser session. Return to the assessment and re-answer your questions.",
    );
  }

  let syncedCount = 0;
  for (const payload of scopedSaves) {
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
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      code?: string;
      skipped?: boolean;
    };
    // Soft-skip (200) or legacy 400 — either way, out-of-scope must not
    // block scoring the pillar the client just finished.
    if (
      body.code === "PILLAR_OUT_OF_SCOPE" ||
      body.skipped === true ||
      body.error?.includes("not included in your assessment scope") ||
      body.message?.includes("not included in your assessment scope")
    ) {
      continue;
    }
    if (!response.ok) {
      throw new Error(body.error ?? body.message ?? "Failed to sync assessment answers");
    }
    syncedCount += 1;
  }

  if (syncedCount === 0) {
    throw new Error(
      "No saved answers found in this browser session. Return to the assessment and re-answer your questions.",
    );
  }

  return { syncedCount, skippedOutOfScope };
}
