import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";
import { conditionSchema } from "@/lib/admin/recommendation-rule-schemas";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";

export const CONDITION_TYPE_OPTIONS = [
  {
    value: "score_threshold" as const,
    label: "Pillar score",
    description: "Fire when a pillar's resilience score crosses a threshold.",
  },
  {
    value: "risk_level" as const,
    label: "Risk level",
    description: "Fire when a pillar is rated at specific risk levels.",
  },
  {
    value: "answer_match" as const,
    label: "Intake answer",
    description: "Fire when a client answers a specific intake question a certain way.",
  },
  {
    value: "missing_control" as const,
    label: "Missing control",
    description: "Fire when a required control is absent for a question.",
  },
  {
    value: "profile_condition" as const,
    label: "Household profile",
    description: "Compare a household profile field (advanced).",
  },
];

export const SCORE_OPERATOR_OPTIONS = [
  { value: "less_than" as const, label: "is below" },
  { value: "greater_than" as const, label: "is above" },
  { value: "equals" as const, label: "is exactly" },
];

export const RISK_LEVEL_OPTIONS = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "high" as const, label: "High" },
  { value: "critical" as const, label: "Critical" },
];

export const RISK_LEVEL_OPERATOR_OPTIONS = [
  { value: "equals" as const, label: "is exactly" },
  { value: "in" as const, label: "is one of" },
];

export const ANSWER_OPERATOR_OPTIONS = [
  { value: "equals" as const, label: "equals" },
  { value: "in" as const, label: "is one of" },
  { value: "contains" as const, label: "includes" },
];

export const PROFILE_OPERATOR_OPTIONS = [
  { value: "greater_than" as const, label: "is above" },
  { value: "less_than" as const, label: "is below" },
  { value: "equals" as const, label: "equals" },
  { value: "in" as const, label: "is one of" },
];

export const PILLAR_OPTIONS = starterPillarCatalog()
  .sort((a, b) => a.displayOrder - b.displayOrder)
  .map((p) => ({ value: p.id, label: p.name }));

export function defaultTriggerCondition(): RecommendationCondition {
  return {
    type: "score_threshold",
    pillarId: PILLAR_OPTIONS[0]?.value ?? "cyber-digital",
    operator: "less_than",
    value: 1.8,
    weight: 3,
  };
}

/** Parse stored JSON into validated conditions; drop invalid entries. */
export function parseStoredTriggerConditions(raw: unknown): RecommendationCondition[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [defaultTriggerCondition()];
  }

  const parsed: RecommendationCondition[] = [];
  for (const item of raw) {
    const result = conditionSchema.safeParse(item);
    if (result.success) parsed.push(result.data);
  }

  return parsed.length > 0 ? parsed : [defaultTriggerCondition()];
}

export type PillarThresholdRow = {
  pillarId: string;
  min: number;
  max: number;
};

export function parseStoredPillarThresholds(raw: unknown): PillarThresholdRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rows: PillarThresholdRow[] = [];
  for (const [pillarId, bounds] of Object.entries(raw as Record<string, unknown>)) {
    if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) continue;
    const min = Number((bounds as { min?: unknown }).min);
    const max = Number((bounds as { max?: unknown }).max);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      rows.push({ pillarId, min, max });
    }
  }
  return rows;
}

export function pillarThresholdRowsToRecord(
  rows: PillarThresholdRow[],
): Record<string, { min: number; max: number }> | null {
  const record: Record<string, { min: number; max: number }> = {};
  for (const row of rows) {
    if (!row.pillarId.trim()) continue;
    record[row.pillarId] = { min: row.min, max: row.max };
  }
  return Object.keys(record).length > 0 ? record : null;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RulePickerAnswerOption = {
  value: string;
  label: string;
};

/** Serializable question row for the admin rule form picker. */
export type RulePickerQuestion = {
  questionId: string;
  text: string;
  pillarId: string;
  pillarName: string;
  type: string;
  answerOptions: RulePickerAnswerOption[];
};

export function findRulePickerQuestion(
  questions: RulePickerQuestion[],
  questionId: string,
): RulePickerQuestion | undefined {
  return questions.find((question) => question.questionId === questionId);
}

export function formatRulePickerQuestionLabel(question: RulePickerQuestion): string {
  return question.text.length > 120 ? `${question.text.slice(0, 117)}…` : question.text;
}

/** Read service recommendation id from advisor/enterprise rule JSON payload. */
export function serviceIdFromRulePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const row = payload as { serviceRecommendationId?: unknown; serviceId?: unknown };
  if (typeof row.serviceRecommendationId === "string" && row.serviceRecommendationId) {
    return row.serviceRecommendationId;
  }
  if (typeof row.serviceId === "string" && row.serviceId) {
    return row.serviceId;
  }
  return null;
}

export function riskLevelsFromValue(
  value: RecommendationCondition & { type: "risk_level" },
): RiskLevel[] {
  const levels = Array.isArray(value.value) ? value.value : [value.value];
  return levels.filter((level): level is RiskLevel =>
    level === "low" || level === "medium" || level === "high" || level === "critical",
  );
}

export function answerMatchListFromValue(
  value: RecommendationCondition & { type: "answer_match" },
): string {
  if (Array.isArray(value.value)) {
    return value.value.map(String).join(", ");
  }
  return String(value.value);
}
