/**
 * Phase 3 feature gate for LLM-generated recommendation narratives.
 *
 * OFF by default. Enable per-environment only after the data-processing sign-off
 * (see docs/llm-recommendation-narratives-data-flow.md) and a staging validation
 * run. Kept as a single env flag so it can be flipped in Vercel without a deploy
 * and rolled back instantly.
 */
export function isNarrativeGenerationEnabled(): boolean {
  return process.env.LLM_NARRATIVES_ENABLED === "true";
}
