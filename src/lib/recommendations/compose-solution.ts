import "server-only";

import type {
  ServiceRecommendation,
  EnterpriseSolutionCustomization,
  AdvisorSolutionCustomization,
  MilestoneSource,
} from "@prisma/client";
import type { FieldOverridePolicy } from "@/lib/asset-catalog/types";
import { composeAsset } from "@/lib/asset-catalog/inheritance-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlaybookStep = {
  title: string;
  description?: string;
  estimatedDuration?: string;
  sortOrder: number;
};

export type ComposedPlaybookStep = PlaybookStep & {
  source: MilestoneSource;
};

export type SourceLayerSummary = {
  platform: boolean;
  enterprise: { id: string; name: string } | null;
  advisor: { id: string; name: string } | null;
};

export type ComposedSolution = {
  serviceId: string;
  name: string;
  description: string;
  shortDescription: string | null;
  category: string;
  icon: string | null;
  expectedOutcome: string | null;
  tags: string[];
  estimatedCost: string | null;
  timeframe: string | null;
  provider: string | null;
  externalUrl: string | null;
  prerequisites: string[];
  playbook: ComposedPlaybookStep[];
  notes: string[];
  sourceLayer: SourceLayerSummary;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePlaybookSteps(json: unknown): PlaybookStep[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.steps)) return [];
  return (obj.steps as Record<string, unknown>[])
    .filter((s) => typeof s.title === "string")
    .map((s, i) => ({
      title: s.title as string,
      description: (s.description as string) ?? undefined,
      estimatedDuration: (s.estimatedDuration as string) ?? undefined,
      sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : i,
    }));
}

// ---------------------------------------------------------------------------
// Core composition
// ---------------------------------------------------------------------------

type ComposeInput = {
  service: ServiceRecommendation;
  enterpriseCustomization?: EnterpriseSolutionCustomization | null;
  advisorCustomization?: AdvisorSolutionCustomization | null;
  enterpriseName?: string | null;
  advisorName?: string | null;
  /** When provided, use the generic inheritance engine for scalar override enforcement. */
  overridePolicies?: FieldOverridePolicy[];
};

/**
 * Compose a final client-facing solution from the platform catalog entry
 * plus optional enterprise and advisor overlays.
 *
 * Overlay precedence (last writer wins for scalar overrides):
 *   platform → enterprise → advisor
 *
 * Playbook steps are *appended* (additive-only), never replaced.
 * Notes from each layer are collected into an ordered array.
 */
export function composeSolution(input: ComposeInput): ComposedSolution {
  const {
    service,
    enterpriseName,
    advisorName,
    overridePolicies,
  } = input;

  // Gate all overlay logic on isActive — inactive overlays are invisible
  const ec = input.enterpriseCustomization?.isActive
    ? input.enterpriseCustomization
    : null;
  const ac = input.advisorCustomization?.isActive
    ? input.advisorCustomization
    : null;

  // --- Scalar overrides ---
  // When overridePolicies provided, use the generic inheritance engine for
  // policy enforcement (PROTECTED fields stay platform, CONFIGURABLE uses
  // last-writer-wins, ADDITION concatenates). Otherwise use current behavior.
  let estimatedCost: string | null;
  let timeframe: string | null;
  let provider: string | null;

  if (overridePolicies && overridePolicies.length > 0) {
    const scalarFields = {
      estimatedCost: service.estimatedCost,
      timeframe: service.timeframe,
      provider: service.provider,
    };
    const composed = composeAsset(
      {
        platform: scalarFields,
        enterprise: ec
          ? {
              estimatedCost: ec.costOverride ?? undefined,
              timeframe: ec.timeframeOverride ?? undefined,
              provider: ec.providerOverride ?? undefined,
            }
          : null,
        advisor: ac
          ? {
              estimatedCost: ac.costOverride ?? undefined,
              timeframe: ac.timeframeOverride ?? undefined,
              provider: ac.providerOverride ?? undefined,
            }
          : null,
      },
      overridePolicies
    );
    estimatedCost = (composed.estimatedCost as string | null) ?? null;
    timeframe = (composed.timeframe as string | null) ?? null;
    provider = (composed.provider as string | null) ?? null;
  } else {
    // Default last-writer-wins (backward compatible)
    estimatedCost =
      ac?.costOverride ?? ec?.costOverride ?? service.estimatedCost;
    timeframe =
      ac?.timeframeOverride ?? ec?.timeframeOverride ?? service.timeframe;
    provider =
      ac?.providerOverride ?? ec?.providerOverride ?? service.provider;
  }

  // --- Compose playbook (additive) ---
  const platformSteps = parsePlaybookSteps(service.playbook);
  const enterpriseSteps = ec ? parsePlaybookSteps(ec.additionalPlaybook) : [];
  const advisorSteps = ac ? parsePlaybookSteps(ac.additionalPlaybook) : [];

  const playbook: ComposedPlaybookStep[] = [
    ...platformSteps.map((s) => ({ ...s, source: "PLATFORM" as const })),
    ...enterpriseSteps.map((s) => ({ ...s, source: "ENTERPRISE" as const })),
    ...advisorSteps.map((s) => ({ ...s, source: "ADVISOR" as const })),
  ];

  // Re-sort by sortOrder, with source layer as stable tiebreaker
  const layerOrder: Record<string, number> = { PLATFORM: 0, ENTERPRISE: 1, ADVISOR: 2 };
  playbook.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (layerOrder[a.source] ?? 0) - (layerOrder[b.source] ?? 0);
  });

  // --- Collect notes ---
  const notes: string[] = [];
  if (ec?.notes) notes.push(ec.notes);
  if (ac?.notes) notes.push(ac.notes);

  // --- Source layer summary ---
  const sourceLayer: SourceLayerSummary = {
    platform: true,
    enterprise: ec
      ? { id: ec.enterpriseId, name: enterpriseName ?? "Enterprise" }
      : null,
    advisor: ac
      ? { id: ac.advisorProfileId, name: advisorName ?? "Advisor" }
      : null,
  };

  return {
    serviceId: service.id,
    name: service.name,
    description: service.description,
    shortDescription: service.shortDescription,
    category: service.category,
    icon: service.icon,
    expectedOutcome: service.expectedOutcome,
    tags: service.tags,
    estimatedCost,
    timeframe,
    provider,
    externalUrl: service.externalUrl,
    prerequisites: service.prerequisites,
    playbook,
    notes,
    sourceLayer,
  };
}
