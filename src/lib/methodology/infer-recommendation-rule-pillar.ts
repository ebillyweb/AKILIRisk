import { conditionSchema } from "@/lib/admin/recommendation-rule-schemas";
import { PLATFORM_PILLAR_SLUGS } from "@/lib/methodology/pillar-catalog-starter";

function parseTriggerConditionsForInference(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const parsed = [];
  for (const item of raw) {
    const result = conditionSchema.safeParse(item);
    if (result.success) parsed.push(result.data);
  }
  return parsed;
}

const QUESTION_ID_PILLAR_PREFIXES: readonly { prefix: string; slug: string }[] = [
  { prefix: "belvedere-gov-", slug: "governance" },
  { prefix: "belvedere-cyber-", slug: "cyber-digital" },
  { prefix: "belvedere-phys-", slug: "physical-security" },
  { prefix: "belvedere-ins-", slug: "insurance" },
  { prefix: "belvedere-geo-", slug: "geographic-environmental" },
  { prefix: "belvedere-rep-", slug: "reputational-social" },
  { prefix: "belvedere-liq-", slug: "liquidity-cash" },
  { prefix: "belvedere-tax-", slug: "tax-exposure" },
  { prefix: "belvedere-est-", slug: "estate-succession" },
  { prefix: "belvedere-beh-", slug: "family-governance-behavioral" },
  { prefix: "governance_", slug: "governance" },
  { prefix: "cyber_", slug: "cyber-digital" },
  { prefix: "physical_", slug: "physical-security" },
  { prefix: "insurance_", slug: "insurance" },
  { prefix: "geographic_", slug: "geographic-environmental" },
  { prefix: "social_", slug: "reputational-social" },
  { prefix: "liquidity_", slug: "liquidity-cash" },
  { prefix: "tax_", slug: "tax-exposure" },
  { prefix: "estate_", slug: "estate-succession" },
  { prefix: "behavioral_", slug: "family-governance-behavioral" },
];

const SERVICE_ID_PILLAR_PREFIXES: readonly { prefix: string; slug: string }[] = [
  { prefix: "governance_", slug: "governance" },
  { prefix: "cyber_", slug: "cyber-digital" },
  { prefix: "physical_", slug: "physical-security" },
  { prefix: "insurance_", slug: "insurance" },
  { prefix: "geographic_", slug: "geographic-environmental" },
  { prefix: "social_", slug: "reputational-social" },
  { prefix: "liquidity_", slug: "liquidity-cash" },
  { prefix: "tax_", slug: "tax-exposure" },
  { prefix: "estate_", slug: "estate-succession" },
  { prefix: "behavioral_", slug: "family-governance-behavioral" },
];

function slugFromPrefix(
  value: string,
  table: readonly { prefix: string; slug: string }[],
): string | null {
  const normalized = value.trim().toLowerCase();
  for (const entry of table) {
    if (normalized.startsWith(entry.prefix)) {
      return entry.slug;
    }
  }
  return null;
}

function normalizePillarSlug(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const slug = raw.trim();
  return (PLATFORM_PILLAR_SLUGS as readonly string[]).includes(slug) ? slug : slug;
}

/** Infer pillar slug from platform rule trigger JSON (array of conditions). */
export function inferPillarSlugFromRecommendationRule(input: {
  triggerConditions: unknown;
  serviceRecommendationId?: string | null;
  ruleName?: string | null;
}): string | null {
  const conditions = parseTriggerConditionsForInference(input.triggerConditions);
  for (const condition of conditions) {
    if ("pillarId" in condition && typeof condition.pillarId === "string") {
      const slug = normalizePillarSlug(condition.pillarId);
      if (slug) return slug;
    }
    if ("questionId" in condition && typeof condition.questionId === "string") {
      const fromQuestion = slugFromPrefix(condition.questionId, QUESTION_ID_PILLAR_PREFIXES);
      if (fromQuestion) return fromQuestion;
    }
  }

  if (input.serviceRecommendationId) {
    const fromService = slugFromPrefix(
      input.serviceRecommendationId,
      SERVICE_ID_PILLAR_PREFIXES,
    );
    if (fromService) return fromService;
  }

  if (input.ruleName) {
    const fromName = slugFromPrefix(input.ruleName.toLowerCase().replace(/\s+/g, "_"), SERVICE_ID_PILLAR_PREFIXES);
    if (fromName) return fromName;
  }

  return null;
}

export function pillarIdForRecommendationRule(
  input: {
    triggerConditions: unknown;
    serviceRecommendationId?: string | null;
    ruleName?: string | null;
  },
  slugToPillarId: Map<string, string>,
): string | null {
  const slug = inferPillarSlugFromRecommendationRule(input);
  if (!slug) return null;
  return slugToPillarId.get(slug) ?? null;
}
