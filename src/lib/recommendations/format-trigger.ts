/**
 * Human-readable one-liner from AssessmentRecommendation.triggerReason JSON.
 */
export function formatTriggerSummary(triggerReason: unknown): string {
  if (!triggerReason || typeof triggerReason !== "object") {
    return "Matched assessment rules";
  }
  // Handle both { reasons: [...] } and plain [...] formats
  const reasons = Array.isArray(triggerReason)
    ? triggerReason
    : (triggerReason as { reasons?: unknown }).reasons;
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return "Matched assessment rules";
  }
  const strings = reasons
    .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    .map((r) => (r.length > 80 ? `${r.slice(0, 77)}…` : r));
  if (strings.length === 0) return "Matched assessment rules";
  const head = strings.slice(0, 2).join(" · ");
  return strings.length > 2 ? `${head} · +${strings.length - 2} more` : head;
}
