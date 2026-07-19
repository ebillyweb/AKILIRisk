/**
 * Phase 3 orchestration — generate AI narratives for an assessment's already-
 * selected recommendations and attach them, fail-closed.
 *
 * Design guarantees:
 *   - Runs POST-commit, fire-and-forget from the score route: never inside the
 *     scoring transaction (no network call holding a DB connection) and never
 *     blocking the score response.
 *   - The deterministic engine has ALREADY chosen the services; this only drafts
 *     prose for them, grounded in the client's weak findings.
 *   - Every pillar group is isolated; a failure (bad output, API error, thin
 *     grounding) leaves that group on today's static copy. Nothing is ever
 *     thrown to the caller.
 *   - Dependencies are injected so the orchestration is unit-tested without a DB
 *     or a live model.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import { makeOpenAIGenerate } from "./providers/openai-provider";
import { loadWeakFindingsByPillar, loadServicePillarMap } from "./narrative-data";
import {
  renderNarrativeUserMessage,
  validateNarrativeOutput,
  type NarrativeInput,
  type NarrativeOutput,
  type WeakFinding,
} from "./shape-a-prompt";

export type RecommendationRow = {
  recId: string;
  serviceId: string;
  name: string;
  description: string;
};

export type PillarMeta = {
  name: string;
  score: number;
  riskLevel: NarrativeInput["pillar"]["riskLevel"];
};

/** The narrative text stored on a single recommendation (`customization.aiNarrative`). */
export type StoredNarrative = {
  pillarSummary: string;
  headline: string;
  rationale: string;
  tailoredActions: string[];
  citedFindings: string[];
  confidence: "high" | "medium" | "low";
};

export type GenerationMeta = {
  provider: "openai";
  model: string;
  promptHash: string;
  validated: boolean;
  generatedAt: string;
};

export type NarrativeDeps = {
  loadRecommendations: (assessmentId: string) => Promise<RecommendationRow[]>;
  loadPillarMeta: (assessmentId: string) => Promise<Map<string, PillarMeta>>;
  loadWeakFindingsByPillar: (assessmentId: string) => Promise<Map<string, WeakFinding[]>>;
  loadServicePillarMap: () => Promise<Map<string, string>>;
  generate: (input: NarrativeInput) => Promise<NarrativeOutput>;
  persist: (recId: string, narrative: StoredNarrative, meta: GenerationMeta) => Promise<void>;
  model: string;
  now: () => string;
};

export type GenerationSummary = {
  pillarsProcessed: number;
  pillarsSucceeded: number;
  narrativesWritten: number;
  pillarsFailed: number;
  pillarsSkipped: number;
};

const RISK_LEVEL_MAP: Record<string, NarrativeInput["pillar"]["riskLevel"]> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

function promptHash(input: NarrativeInput): string {
  return createHash("sha256").update(renderNarrativeUserMessage(input)).digest("hex").slice(0, 16);
}

/**
 * Pure orchestration over injected deps. Exported for tests; the flag-gated
 * `generateAndAttachNarratives` wraps this with the real dependencies.
 */
export async function runNarrativeGeneration(
  assessmentId: string,
  deps: NarrativeDeps,
): Promise<GenerationSummary> {
  const summary: GenerationSummary = {
    pillarsProcessed: 0,
    pillarsSucceeded: 0,
    narrativesWritten: 0,
    pillarsFailed: 0,
    pillarsSkipped: 0,
  };

  const recommendations = await deps.loadRecommendations(assessmentId);
  if (recommendations.length === 0) return summary;

  const [servicePillar, weakByPillar, pillarMeta] = await Promise.all([
    deps.loadServicePillarMap(),
    deps.loadWeakFindingsByPillar(assessmentId),
    deps.loadPillarMeta(assessmentId),
  ]);

  // Group recommendations under their home pillar.
  const byPillar = new Map<string, RecommendationRow[]>();
  for (const rec of recommendations) {
    const pillar = servicePillar.get(rec.serviceId);
    if (!pillar) continue; // unmapped service — leave static
    const list = byPillar.get(pillar) ?? [];
    list.push(rec);
    byPillar.set(pillar, list);
  }

  for (const [pillar, recs] of byPillar) {
    summary.pillarsProcessed++;

    const meta = pillarMeta.get(pillar);
    const weakFindings = weakByPillar.get(pillar) ?? [];
    // No grounding => don't generate; static copy is safer than thin prose.
    if (!meta || weakFindings.length === 0) {
      summary.pillarsSkipped++;
      continue;
    }

    const input: NarrativeInput = {
      pillar: { slug: pillar, name: meta.name, score: meta.score, riskLevel: meta.riskLevel },
      weakFindings,
      selectedServices: recs.map((r) => ({
        serviceId: r.serviceId,
        name: r.name,
        description: r.description,
      })),
    };

    try {
      const output = await deps.generate(input);
      const validation = validateNarrativeOutput(output, input);
      if (!validation.ok) {
        summary.pillarsFailed++;
        continue; // fail-closed: static copy
      }

      const meta_: GenerationMeta = {
        provider: "openai",
        model: deps.model,
        promptHash: promptHash(input),
        validated: true,
        generatedAt: deps.now(),
      };

      const byServiceId = new Map(output.recommendations.map((r) => [r.serviceId, r]));
      let wrote = 0;
      for (const rec of recs) {
        const narr = byServiceId.get(rec.serviceId);
        if (!narr) continue;
        await deps.persist(
          rec.recId,
          {
            pillarSummary: output.pillarSummary,
            headline: narr.headline,
            rationale: narr.rationale,
            tailoredActions: narr.tailoredActions,
            citedFindings: narr.citedFindings,
            confidence: narr.confidence,
          },
          meta_,
        );
        wrote++;
      }
      summary.pillarsSucceeded++;
      summary.narrativesWritten += wrote;
    } catch {
      summary.pillarsFailed++;
      // fail-closed: leave static copy
    }
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real dependencies
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gpt-4o";

export async function loadRecommendationsFromDb(
  assessmentId: string,
): Promise<RecommendationRow[]> {
  const rows = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId },
    select: {
      id: true,
      serviceRecommendationId: true,
      serviceRecommendation: { select: { name: true, description: true } },
    },
  });
  return rows.map((r) => ({
    recId: r.id,
    serviceId: r.serviceRecommendationId,
    name: r.serviceRecommendation.name,
    description: r.serviceRecommendation.description,
  }));
}

export async function loadPillarMetaFromDb(
  assessmentId: string,
): Promise<Map<string, PillarMeta>> {
  // Read pillar names straight from the `pillars` table rather than the cached
  // catalog helper — the helper pulls `server-only`, which throws outside an RSC
  // runtime (breaking the CLI scripts) and adds nothing here.
  const [scores, pillars] = await Promise.all([
    prisma.pillarScore.findMany({
      where: { assessmentId },
      select: { pillar: true, score: true, riskLevel: true },
    }),
    prisma.pillar.findMany({ select: { slug: true, canonicalName: true } }),
  ]);
  const nameBySlug = new Map(pillars.map((p) => [p.slug, p.canonicalName]));
  const out = new Map<string, PillarMeta>();
  for (const s of scores) {
    const slug = normalizePillarScoreId(s.pillar);
    out.set(slug, {
      name: nameBySlug.get(slug) ?? slug,
      score: s.score,
      riskLevel: RISK_LEVEL_MAP[s.riskLevel] ?? "medium",
    });
  }
  return out;
}

async function persistNarrativeToDb(
  recId: string,
  narrative: StoredNarrative,
  meta: GenerationMeta,
): Promise<void> {
  const existing = await prisma.assessmentRecommendation.findUnique({
    where: { id: recId },
    select: { customization: true },
  });
  const customization = {
    ...((existing?.customization as Record<string, unknown> | null) ?? {}),
    aiNarrative: narrative,
  };
  await prisma.assessmentRecommendation.update({
    where: { id: recId },
    data: {
      customization: customization as object,
      generationMeta: meta as object,
    },
  });
}

export function buildRealDeps(model: string = DEFAULT_MODEL): NarrativeDeps {
  return {
    loadRecommendations: loadRecommendationsFromDb,
    loadPillarMeta: loadPillarMetaFromDb,
    loadWeakFindingsByPillar,
    loadServicePillarMap,
    generate: makeOpenAIGenerate({ model }),
    persist: persistNarrativeToDb,
    model,
    now: () => new Date().toISOString(),
  };
}

/**
 * Entry point for the score route. Fire-and-forget; resolves to a summary and
 * never rejects. Caller is responsible for the feature-flag check.
 */
export async function generateAndAttachNarratives(
  assessmentId: string,
  deps: NarrativeDeps = buildRealDeps(),
): Promise<GenerationSummary> {
  try {
    return await runNarrativeGeneration(assessmentId, deps);
  } catch {
    return {
      pillarsProcessed: 0,
      pillarsSucceeded: 0,
      narrativesWritten: 0,
      pillarsFailed: 0,
      pillarsSkipped: 0,
    };
  }
}
