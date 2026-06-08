/** Standard document-attachment sub-question prompt (all pillars). */
export const DOCUMENT_UPLOAD_PROMPT =
  "Please attach copies of any relevant supporting documentation, if available.";

export const DOCUMENT_UPLOAD_WHY =
  "Validates existence, completeness, and currency of documented policies and materials.";

export const DOCUMENT_UPLOAD_ACTIONS =
  "Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.";

/** Maturity score (0-based) for the 3rd/4th options that trigger document upload. */
export const DOCUMENT_UPLOAD_MIN_SCORE = 2;

type MaturityLabels = {
  answerType: string;
  answer2?: string | null;
  answer3?: string | null;
};

/**
 * True when upper maturity tiers (answers 2–3) indicate formal documentation exists.
 */
export function scored0_3TierImpliesDocumentation(row: MaturityLabels): boolean {
  if (row.answerType !== "scored_0_3") return false;
  const upperTierText = [row.answer2, row.answer3]
    .map((label) => (label ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return /document/i.test(upperTierText);
}

/** Suggested sub-question id: first letter suffix not already used (A4 → A4b if A4a exists). */
export function suggestDocumentUploadSubNumber(
  parentNumber: string,
  existingSubNumbers: string[]
): string {
  const usedSuffixes = new Set(
    existingSubNumbers
      .filter((n) => n.startsWith(parentNumber) && n.length > parentNumber.length)
      .map((n) => n.slice(parentNumber.length))
  );
  for (const suffix of "abcdefghijklmnopqrstuvwxyz") {
    if (!usedSuffixes.has(suffix)) {
      return `${parentNumber}${suffix}`;
    }
  }
  return `${parentNumber}z`;
}
