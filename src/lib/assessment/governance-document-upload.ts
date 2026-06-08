/** @deprecated Use `@/lib/assessment/document-upload-sub` */
export {
  DOCUMENT_UPLOAD_ACTIONS as GOVERNANCE_DOCUMENT_UPLOAD_ACTIONS,
  DOCUMENT_UPLOAD_MIN_SCORE as GOVERNANCE_DOCUMENT_UPLOAD_MIN_SCORE,
  DOCUMENT_UPLOAD_PROMPT as GOVERNANCE_DOCUMENT_UPLOAD_PROMPT,
  DOCUMENT_UPLOAD_WHY as GOVERNANCE_DOCUMENT_UPLOAD_WHY,
  scored0_3TierImpliesDocumentation,
  suggestDocumentUploadSubNumber,
} from "./document-upload-sub";

/** @deprecated Prefer {@link scored0_3TierImpliesDocumentation} — rule applies to all pillars. */
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

/** @deprecated Use tier-based detection instead of a static parent list. */
export function governanceParentNeedsDocumentUploadSub(_questionNumber: string): boolean {
  return false;
}
