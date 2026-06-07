/** Standard Belvedere governance document-attachment sub-question prompt. */
export const GOVERNANCE_DOCUMENT_UPLOAD_PROMPT =
  "Please attach copies of any relevant supporting documentation, if available.";

export const GOVERNANCE_DOCUMENT_UPLOAD_WHY =
  "Validates existence, completeness, and currency of governance materials.";

export const GOVERNANCE_DOCUMENT_UPLOAD_ACTIONS =
  "Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.";

/** Maturity score (0–3) for 3rd/4th options that trigger document upload. */
export const GOVERNANCE_DOCUMENT_UPLOAD_MIN_SCORE = 2;

type MaturityLabels = {
  answerType: string;
  answer2?: string | null;
  answer3?: string | null;
};

/**
 * True when the upper maturity tiers (answers 2–3) indicate formal documentation exists.
 * Used to decide which governance parents need a document-attachment sub-question.
 */
export function scored0_3TierImpliesDocumentation(row: MaturityLabels): boolean {
  if (row.answerType !== "scored_0_3") return false;
  const upperTierText = [row.answer2, row.answer3]
    .map((label) => (label ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return /document/i.test(upperTierText);
}

/** Parent question numbers in the governance pillar that require a document-upload sub. */
export const GOVERNANCE_DOCUMENT_UPLOAD_PARENT_NUMBERS = [
  "A1",
  "A2",
  "A4",
  "A6",
  "B3",
  "B5",
  "C1",
  "D1",
  "D4",
  "E3",
] as const;

export function governanceParentNeedsDocumentUploadSub(questionNumber: string): boolean {
  return (GOVERNANCE_DOCUMENT_UPLOAD_PARENT_NUMBERS as readonly string[]).includes(
    questionNumber
  );
}

/** Suggested sub-question id: first suffix letter not already used by a sibling sub. */
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
