/**
 * Human-readable formatting for AssessmentRecommendation.triggerReason JSON.
 */

function normalizeReasonString(value: string): string {
  return value.trim();
}

function reasonFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return normalizeReasonString(value);
  }
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") {
      return normalizeReasonString(message);
    }
    const description = (value as { description?: unknown }).description;
    if (typeof description === "string") {
      return normalizeReasonString(description);
    }
  }
  return "";
}

/** Extract plain-English reason lines from triggerReason payloads. */
export function extractRecommendationReasons(
  triggerReason: unknown,
): string[] {
  if (triggerReason == null) return [];

  if (typeof triggerReason === "string") {
    const trimmed = triggerReason.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return extractRecommendationReasons(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }

  if (Array.isArray(triggerReason)) {
    return triggerReason
      .map(reasonFromUnknown)
      .filter((reason) => reason.length > 0);
  }

  if (typeof triggerReason === "object") {
    const reasons = (triggerReason as { reasons?: unknown }).reasons;
    if (Array.isArray(reasons)) {
      return extractRecommendationReasons(reasons);
    }
    const single = reasonFromUnknown(triggerReason);
    return single ? [single] : [];
  }

  return [String(triggerReason)];
}

export function formatRecommendationReasonsParagraph(
  triggerReason: unknown,
): string {
  const reasons = extractRecommendationReasons(triggerReason);
  if (reasons.length === 0) return "";
  if (reasons.length === 1) return reasons[0];
  return reasons
    .map((reason) => (/[.!?]$/.test(reason) ? reason : `${reason}.`))
    .join(" ");
}

/**
 * Human-readable one-liner from AssessmentRecommendation.triggerReason JSON.
 */
export function formatTriggerSummary(triggerReason: unknown): string {
  const reasons = extractRecommendationReasons(triggerReason);
  if (reasons.length === 0) {
    return "Matched assessment rules";
  }
  const strings = reasons.map((r) => (r.length > 80 ? `${r.slice(0, 77)}…` : r));
  const head = strings.slice(0, 2).join(" · ");
  return strings.length > 2 ? `${head} · +${strings.length - 2} more` : head;
}
