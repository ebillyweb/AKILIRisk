/** Answer payload stored when a client uploads documentation for a fillable sub-question. */
export type AssessmentDocumentUploadAnswer = {
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
};

/** Belvedere document-attachment fillable sub-questions (A1a, A4b, …). */
export function isDocumentUploadFillableQuestionText(text: string): boolean {
  const t = text.trim();
  return /attach copies.*documentation/i.test(t) || /obtain copies/i.test(t);
}

export function isAssessmentDocumentUploadAnswer(
  answer: unknown
): answer is AssessmentDocumentUploadAnswer {
  if (!answer || typeof answer !== "object") return false;
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

export function keyMatchesAssessmentQuestionUpload(
  key: string,
  userId: string,
  assessmentId: string,
  questionId: string
): boolean {
  const prefix = `assessment-uploads/${userId}/${assessmentId}/${questionId}/`;
  return key.startsWith(prefix) && key.length > prefix.length;
}
