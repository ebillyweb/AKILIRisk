/**
 * Fixed-input OpenAI probe for LLM recommendation narratives.
 *
 * Uses a synthetic, PII-free golden-shaped payload (no assessment DB reads,
 * no writes). Intended for the scheduled `@smoke` canary and operator checks
 * — not for client-facing generation.
 */

import { makeOpenAIGenerate } from "./providers/openai-provider";
import {
  validateNarrativeOutput,
  type NarrativeInput,
  type NarrativeOutput,
} from "./shape-a-prompt";

/** Synthetic input — catalog-shaped findings only; no client identifiers. */
export const SMOKE_NARRATIVE_INPUT: NarrativeInput = {
  pillar: {
    slug: "ai-emerging-tech",
    name: "AI & Emerging Tech Risk",
    score: 0.7,
    riskLevel: "critical",
  },
  household: { size: 5, hasOperatingBusiness: true },
  weakFindings: [
    {
      questionNumber: "10.1",
      questionText:
        "Are financial and wire-transfer requests verified through a second, out-of-band channel to defend against voice-clone and video deepfake fraud?",
      chosenLevel: 0,
      chosenLabel: "No verification",
      maturityAnchors: [
        "No verification",
        "Informal call-back sometimes",
        "Call-back required",
        "Out-of-band verification enforced and tested",
      ],
    },
    {
      questionNumber: "10.11",
      questionText:
        "Is there a policy governing what family or office information may be entered into public AI tools?",
      chosenLevel: 1,
      chosenLabel: "Informal caution",
      maturityAnchors: [
        "No policy",
        "Informal caution",
        "Written policy",
        "Policy enforced with approved tools",
      ],
    },
  ],
  selectedServices: [
    {
      serviceId: "ai_impersonation_defense",
      name: "AI Impersonation & Deepfake Defense Program",
      description:
        "Out-of-band verification protocols, family code words, and staff training to defend against deepfake and voice-clone fraud.",
    },
    {
      serviceId: "ai_data_governance",
      name: "AI Tool Data Governance Program",
      description:
        "Acceptable-use policy, vendor vetting, and upload controls governing what family and office data may be entered into AI tools.",
    },
  ],
};

export type NarrativeSmokeProbeResult = {
  ok: true;
  model: string;
  pillarSummary: string;
  serviceIds: string[];
  recommendationCount: number;
  validationOk: boolean;
  validationReasons: string[];
};

const DEFAULT_MODEL = "gpt-4o";

/**
 * Call the real OpenAI narrative generator once and return a structural
 * summary. Throws on provider/runtime failure; never persists.
 */
export async function runNarrativeSmokeProbe(opts?: {
  model?: string;
  generate?: (input: NarrativeInput) => Promise<NarrativeOutput>;
}): Promise<NarrativeSmokeProbeResult> {
  const model = opts?.model ?? DEFAULT_MODEL;
  const generate = opts?.generate ?? makeOpenAIGenerate({ model });
  const output = await generate(SMOKE_NARRATIVE_INPUT);
  const validation = validateNarrativeOutput(output, SMOKE_NARRATIVE_INPUT);

  return {
    ok: true,
    model,
    pillarSummary: output.pillarSummary?.trim() ?? "",
    serviceIds: output.recommendations.map((r) => r.serviceId),
    recommendationCount: output.recommendations.length,
    validationOk: validation.ok,
    validationReasons: validation.reasons,
  };
}
