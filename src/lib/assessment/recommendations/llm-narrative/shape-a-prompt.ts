/**
 * LLM-generated recommendation narratives — Shape A ("narrative layer") prototype.
 *
 * Phase 0 scaffold. NOT wired into the runtime. See the scope doc for context:
 * the deterministic engine still SELECTS which services are recommended; this
 * module only drafts the personalized rationale + tailored next steps for those
 * already-selected services, grounded in the client's own assessment answers.
 *
 * Everything here is provider-agnostic:
 *   - OpenAI:    pass `RECOMMENDATION_NARRATIVE_SCHEMA` as
 *               `response_format: { type: "json_schema", json_schema: {...} }`.
 *   - Anthropic: pass it as a tool `input_schema` and force that tool.
 *
 * The schema's `serviceId` enum is injected per-call from the selected services,
 * so the model literally cannot emit a service id that the rules engine didn't
 * pick. The `validateNarrativeOutput` gate re-checks this (fail closed → the
 * caller falls back to today's static catalog copy).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Input payload (what the model is grounded on — PII-minimized)
// ─────────────────────────────────────────────────────────────────────────────

/** One assessment answer that contributed to the pillar's weakness. */
export type WeakFinding = {
  /** e.g. "10.1" — stable within the pillar, used for citation/audit. */
  questionNumber: string;
  questionText: string;
  /** 0 = worst / absent … 3 = most mature. */
  chosenLevel: 0 | 1 | 2 | 3;
  /** The maturity anchor label the client selected (e.g. "No verification"). */
  chosenLabel: string;
  /** The 0→3 anchor ladder, so the model can see what "good" looks like. */
  maturityAnchors: [string, string, string, string];
};

/** A service the rules engine already selected — the ONLY services the model may write about. */
export type SelectedService = {
  serviceId: string;
  name: string;
  description: string;
};

/**
 * Non-identifying household shape. No names, emails, or free-text.
 * `hasMinors` was intentionally removed from what leaves the system — see
 * docs/llm-recommendation-narratives-data-flow.md.
 */
export type HouseholdShape = {
  size?: number;
  hasOperatingBusiness?: boolean;
  travelsInternationally?: boolean;
};

export type NarrativeInput = {
  pillar: {
    slug: string;
    name: string;
    /** 0–3 maturity score. */
    score: number;
    riskLevel: "critical" | "high" | "medium" | "low";
  };
  household?: HouseholdShape;
  /** The low-maturity answers that drove the score — the source of specificity. */
  weakFindings: WeakFinding[];
  /** Rules-selected services. Must be non-empty. */
  selectedServices: SelectedService[];
  /**
   * Optional advisor/firm voice alignment. Only a tone hint is sent — the firm
   * name is intentionally NOT part of the payload (see the data-flow doc).
   */
  firm?: { tone?: string };
};

// ─────────────────────────────────────────────────────────────────────────────
// Structured-output JSON schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the response schema for a single generation call. The `serviceId` enum
 * is pinned to exactly the selected services so the model cannot invent one.
 */
export function buildNarrativeSchema(allowedServiceIds: string[]) {
  return {
    name: "recommendation_narrative",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["pillarSummary", "recommendations"],
      properties: {
        pillarSummary: {
          type: "string",
          description:
            "2–3 sentence advisor-voice summary of this pillar's posture for THIS household, grounded in the findings. Non-alarmist. No figures.",
        },
        recommendations: {
          type: "array",
          description:
            "Exactly one entry per selected service, in the order provided. No additions, omissions, or reordering.",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "serviceId",
              "headline",
              "rationale",
              "tailoredActions",
              "citedFindings",
              "confidence",
            ],
            properties: {
              serviceId: {
                type: "string",
                enum: allowedServiceIds,
                description: "Must be one of the provided service ids.",
              },
              headline: {
                type: "string",
                description:
                  "≤ 10 words, specific to this household. Not a restatement of the service name.",
              },
              rationale: {
                type: "string",
                description:
                  "2–4 sentences on why THIS household needs this service, citing their specific weak answers. No invented facts, figures, providers, or laws. No cost/timeframe (shown elsewhere).",
              },
              tailoredActions: {
                type: "array",
                description: "2–4 concrete next steps as imperative phrases.",
                items: { type: "string" },
                minItems: 2,
                maxItems: 4,
              },
              citedFindings: {
                type: "array",
                description:
                  "The questionNumber(s) from the input whose answers this rationale relies on. Used for grounding/audit. Empty only if the rationale is deliberately general (then set confidence 'low').",
                items: { type: "string" },
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
                description:
                  "'low' when the input lacked enough specific findings to justify a tailored rationale.",
              },
            },
          },
        },
      },
    },
  } as const;
}

/** The shape the model returns (mirror of the schema, for the validator/callers). */
export type NarrativeOutput = {
  pillarSummary: string;
  recommendations: Array<{
    serviceId: string;
    headline: string;
    rationale: string;
    tailoredActions: string[];
    citedFindings: string[];
    confidence: "high" | "medium" | "low";
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// System prompt (the guardrails live here)
// ─────────────────────────────────────────────────────────────────────────────

export const NARRATIVE_SYSTEM_PROMPT = `You are a risk-advisory writing assistant for a firm that serves high-net-worth families. A deterministic rules engine has ALREADY selected the remediation services below based on the client's assessment scores. Your only job is to write a personalized, professional rationale and concrete next steps for those services, grounded in the client's own answers.

GROUNDING — non-negotiable:
- Write about ONLY the services provided in the input. Never invent, add, rename, drop, or reorder services. Use the exact serviceId values given, one recommendation per selected service, in the given order.
- Base every rationale on the client's actual weak findings in the input. In citedFindings, list the questionNumber(s) you relied on. If the findings are too thin to justify a specific rationale, keep it general and set confidence to "low".
- Never state or invent facts that are not in the input: no dollar amounts, percentages, statistics, provider or product names, laws, regulations, or case citations. Do NOT mention cost or timeframe — those are shown elsewhere.

TONE:
- Professional, measured, and specific — the way a trusted advisor writes, not marketing copy.
- Address the household in the second person ("your household", "you"). Plain language over jargon.
- Non-alarmist. Describe exposure and the concrete step to reduce it. Never guarantee outcomes, and never frame anything as definitive legal, tax, or investment advice.

OUTPUT:
- Return only the structured object required by the schema. No preamble, no markdown, no commentary.
- pillarSummary: 2–3 sentences. headline: ≤ 10 words. rationale: 2–4 sentences. tailoredActions: 2–4 imperative phrases.`;

// ─────────────────────────────────────────────────────────────────────────────
// User message (compact, structured — not prose)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the input as the user/developer message. Structured JSON keeps the
 * model grounded and makes the call cacheable by a hash of this string.
 */
export function renderNarrativeUserMessage(input: NarrativeInput): string {
  // Reconstruct household and firm from an explicit allowlist so that only
  // vetted fields can leave the system, regardless of what a caller passes in.
  // JSON.stringify drops undefined-valued keys, so absent fields are omitted.
  const household = {
    size: input.household?.size,
    hasOperatingBusiness: input.household?.hasOperatingBusiness,
    travelsInternationally: input.household?.travelsInternationally,
  };
  const firm = { tone: input.firm?.tone };
  const payload = {
    pillar: input.pillar,
    household,
    firm,
    weakFindings: input.weakFindings.map((f) => ({
      questionNumber: f.questionNumber,
      question: f.questionText,
      clientAnswer: `${f.chosenLevel} — ${f.chosenLabel}`,
      maturityLadder: f.maturityAnchors,
    })),
    selectedServices: input.selectedServices.map((s) => ({
      serviceId: s.serviceId,
      name: s.name,
      description: s.description,
    })),
  };
  return [
    "Write one recommendation per selected service, grounded in the weak findings.",
    "Input:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

/** Suggested call parameters. Low temperature for consistency/cacheability. */
export const NARRATIVE_CALL_PARAMS = {
  temperature: 0.3,
  maxOutputTokens: 1200,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Grounding validator (hard gate — fail closed → caller uses static copy)
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationResult = { ok: boolean; reasons: string[] };

/**
 * Verify the model stayed within its lane. On any failure the caller should
 * discard the generation and fall back to the static catalog copy.
 */
export function validateNarrativeOutput(
  output: NarrativeOutput,
  input: NarrativeInput,
): ValidationResult {
  const reasons: string[] = [];
  const allowedIds = new Set(input.selectedServices.map((s) => s.serviceId));
  const allowedFindings = new Set(input.weakFindings.map((f) => f.questionNumber));

  if (!output.pillarSummary?.trim()) reasons.push("Empty pillarSummary.");

  const returnedIds = output.recommendations.map((r) => r.serviceId);

  // 1. No invented or duplicated services; exact coverage of the selected set.
  for (const id of returnedIds) {
    if (!allowedIds.has(id)) reasons.push(`Hallucinated serviceId: ${id}`);
  }
  if (new Set(returnedIds).size !== returnedIds.length) {
    reasons.push("Duplicate serviceId in output.");
  }
  for (const id of allowedIds) {
    if (!returnedIds.includes(id)) reasons.push(`Missing recommendation for selected service: ${id}`);
  }

  // 2. Forbidden fabricated specifics (costs, percentages, guarantees).
  //    Costs/timeframes come from the catalog, never the model.
  const forbidden = /(\$\s?\d|\bUSD\b|\b\d+(\.\d+)?\s?%|\bguarantee(s|d)?\b|\bwill eliminate\b)/i;
  for (const r of output.recommendations) {
    const blob = `${r.headline} ${r.rationale} ${r.tailoredActions.join(" ")}`;
    if (forbidden.test(blob)) {
      reasons.push(`Recommendation ${r.serviceId} contains a forbidden figure/guarantee.`);
    }
    if (!r.rationale?.trim()) reasons.push(`Recommendation ${r.serviceId} has empty rationale.`);
    if (r.tailoredActions.length < 2) reasons.push(`Recommendation ${r.serviceId} has < 2 actions.`);
    // 3. Grounding: cited findings must be real (soft unless confidence is high).
    const unknownCites = r.citedFindings.filter((c) => !allowedFindings.has(c));
    if (unknownCites.length) {
      reasons.push(`Recommendation ${r.serviceId} cites unknown finding(s): ${unknownCites.join(", ")}`);
    }
    if (r.confidence === "high" && r.citedFindings.length === 0) {
      reasons.push(`Recommendation ${r.serviceId} claims high confidence with no cited findings.`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
