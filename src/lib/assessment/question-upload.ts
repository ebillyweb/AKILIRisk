/** Single uploaded file metadata for an assessment document-attachment answer. */
export type AssessmentDocumentUploadFile = {
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
};

/** Up to {@link MAX_ASSESSMENT_QUESTION_UPLOADS} files per document-attachment question. */
export type AssessmentDocumentUploadAnswer = AssessmentDocumentUploadFile[];

export const MAX_ASSESSMENT_QUESTION_UPLOADS = 5;

/** Belvedere document-attachment fillable sub-questions (A1a, A4b, …). */
export function isDocumentUploadFillableQuestionText(text: string): boolean {
  const t = text.trim();
  return /attach copies.*documentation/i.test(t) || /obtain copies/i.test(t);
}

export function isAssessmentDocumentUploadFile(
  answer: unknown
): answer is AssessmentDocumentUploadFile {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
  const a = answer as Record<string, unknown>;
  return (
    typeof a.fileKey === "string" &&
    a.fileKey.length > 0 &&
    typeof a.fileName === "string" &&
    a.fileName.length > 0 &&
    typeof a.fileSize === "number" &&
    a.fileSize > 0 &&
    typeof a.fileMimeType === "string" &&
    a.fileMimeType.length > 0
  );
}

/** Normalizes legacy single-file answers and caps at the upload limit. */
export function normalizeAssessmentDocumentUploadAnswer(
  answer: unknown
): AssessmentDocumentUploadAnswer {
  if (Array.isArray(answer)) {
    return answer
      .filter(isAssessmentDocumentUploadFile)
      .slice(0, MAX_ASSESSMENT_QUESTION_UPLOADS);
  }
  if (isAssessmentDocumentUploadFile(answer)) {
    return [answer];
  }
  return [];
}

export function isAssessmentDocumentUploadAnswer(
  answer: unknown
): answer is AssessmentDocumentUploadAnswer {
  if (Array.isArray(answer)) {
    return (
      answer.length >= 1 &&
      answer.length <= MAX_ASSESSMENT_QUESTION_UPLOADS &&
      answer.every(isAssessmentDocumentUploadFile)
    );
  }
  return isAssessmentDocumentUploadFile(answer);
}

export function keyMatchesAssessmentQuestionUpload(
  key: string,
  userId: string,
  assessmentId: string,
  questionId: string
): boolean {
  const prefix = `assessment-uploads/${userId}/${assessmentId}/${questionId}/`;
  return key.startsWith(prefix) && key.length > prefix.length;
}

/** True when a document-attachment question was skipped or has no files — flag for reviewers. */
export function documentUploadNeedsReviewerAttention(
  questionType: string | undefined,
  answer: unknown,
  skipped: boolean
): boolean {
  if (questionType !== "document-upload") return false;
  if (skipped) return true;
  return normalizeAssessmentDocumentUploadAnswer(answer).length === 0;
}

export function hasDocumentUploadFiles(answer: unknown): boolean {
  return normalizeAssessmentDocumentUploadAnswer(answer).length > 0;
}
