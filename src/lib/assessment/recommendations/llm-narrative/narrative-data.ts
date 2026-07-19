/**
 * DB data layer for Phase 3 narrative generation.
 *
 * Pulls the two pieces of grounding the generator needs, straight from the
 * database (decoupled from the single-pillar score POST):
 *   - `loadWeakFindingsByPillar` — the client's low-maturity answers, grouped by
 *     pillar slug, with the question text + 0→3 anchor ladder. This is the source
 *     of every rationale's specificity.
 *   - `loadServicePillarMap` — maps each service id to its "home" pillar (the
 *     pillar of its dominant score_threshold rule), so a matched recommendation
 *     can be grouped under the pillar whose findings justify it.
 *
 * Answers are stored AES-256-GCM encrypted; we decrypt read-only via the shared
 * helper and never touch the ciphertext column directly.
 */

import { prisma } from "@/lib/db";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import type { WeakFinding } from "./shape-a-prompt";

/** Only answers at or below this 0–3 maturity level count as "weak". */
const WEAK_MATURITY_MAX = 1;
/** Cap findings per pillar so the prompt stays focused and cheap. */
const MAX_FINDINGS_PER_PILLAR = 6;

type QuestionRow = {
  id: string;
  questionNumber: string | null;
  questionText: string;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
};

/** Coerce a decrypted answer to a 0–3 maturity index, or null if not scored_0_3. */
function toMaturityLevel(raw: unknown): 0 | 1 | 2 | 3 | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 3) return null;
  return n as 0 | 1 | 2 | 3;
}

/**
 * Load the client's weak answers grouped by pillar slug. Reads assessment
 * responses (decrypting each), joins the question bank for text + anchors, keeps
 * only scored_0_3 answers at maturity <= 1, and returns the most severe first.
 */
export async function loadWeakFindingsByPillar(
  assessmentId: string,
): Promise<Map<string, WeakFinding[]>> {
  const responses = await prisma.assessmentResponse.findMany({
    where: { assessmentId, skipped: false },
    select: { questionId: true, pillar: true, answer: true },
  });
  if (responses.length === 0) return new Map();

  const questionIds = [...new Set(responses.map((r) => r.questionId))];
  const questions = (await prisma.pillarQuestion.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      questionNumber: true,
      questionText: true,
      answer0: true,
      answer1: true,
      answer2: true,
      answer3: true,
    },
  })) as QuestionRow[];
  const byId = new Map(questions.map((q) => [q.id, q]));

  const grouped = new Map<string, Array<WeakFinding & { level: number }>>();

  for (const res of responses) {
    const q = byId.get(res.questionId);
    if (!q) continue;

    const decrypted = safeDecryptAnswer(res.answer as unknown as string | null, {
      rowId: res.questionId,
      column: "AssessmentResponse.answer",
    });
    const level = toMaturityLevel(decrypted);
    if (level === null || level > WEAK_MATURITY_MAX) continue;

    const anchors: [string, string, string, string] = [
      q.answer0 ?? "",
      q.answer1 ?? "",
      q.answer2 ?? "",
      q.answer3 ?? "",
    ];
    // Need the chosen label and at least some anchor context to be groundable.
    const chosenLabel = anchors[level];
    if (!chosenLabel) continue;

    const finding: WeakFinding & { level: number } = {
      questionNumber: q.questionNumber ?? q.id,
      questionText: q.questionText,
      chosenLevel: level,
      chosenLabel,
      maturityAnchors: anchors,
      level,
    };
    const list = grouped.get(res.pillar) ?? [];
    list.push(finding);
    grouped.set(res.pillar, list);
  }

  // Most severe (lowest maturity) first, capped per pillar; strip the sort key.
  const out = new Map<string, WeakFinding[]>();
  for (const [pillar, list] of grouped) {
    list.sort((a, b) => a.level - b.level);
    out.set(
      pillar,
      list.slice(0, MAX_FINDINGS_PER_PILLAR).map(({ level: _level, ...f }) => f),
    );
  }
  return out;
}

type RuleConditionLike = {
  type?: string;
  pillarId?: string;
  weight?: number;
};

/**
 * Map each service id to its home pillar slug: the pillarId of the highest-weight
 * score_threshold / risk_level condition across that service's rules. Cross-link
 * rules (which point a service at a different pillar) carry lower weight than the
 * service's own dominant rule, so the home pillar wins deterministically.
 */
export async function loadServicePillarMap(): Promise<Map<string, string>> {
  const rules = await prisma.recommendationRule.findMany({
    select: { serviceRecommendationId: true, triggerConditions: true },
  });

  // serviceId -> { pillar -> best weight seen }
  const best = new Map<string, { pillar: string; weight: number }>();

  for (const rule of rules) {
    const conditions = Array.isArray(rule.triggerConditions)
      ? (rule.triggerConditions as RuleConditionLike[])
      : [];
    for (const c of conditions) {
      if ((c.type !== "score_threshold" && c.type !== "risk_level") || !c.pillarId) continue;
      const weight = typeof c.weight === "number" ? c.weight : 1;
      const current = best.get(rule.serviceRecommendationId);
      if (!current || weight > current.weight) {
        best.set(rule.serviceRecommendationId, { pillar: c.pillarId, weight });
      }
    }
  }

  return new Map([...best].map(([serviceId, v]) => [serviceId, v.pillar]));
}
