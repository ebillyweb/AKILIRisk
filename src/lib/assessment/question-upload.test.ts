import { describe, expect, it } from "vitest";
import {
  documentUploadNeedsReviewerAttention,
  hasDocumentUploadFiles,
  isAssessmentDocumentUploadAnswer,
  isAssessmentDocumentUploadFile,
  isDocumentUploadFillableQuestionText,
  keyMatchesAssessmentQuestionUpload,
  MAX_ASSESSMENT_QUESTION_UPLOADS,
  normalizeAssessmentDocumentUploadAnswer,
} from "./question-upload";

const sampleFile = {
  fileKey: "assessment-uploads/u/a/q/file.pdf",
  fileName: "charter.pdf",
  fileSize: 1024,
  fileMimeType: "application/pdf",
};

describe("question-upload helpers", () => {
  it("detects document-attachment fillable prompts", () => {
    expect(
      isDocumentUploadFillableQuestionText(
        "Please attach copies of any relevant supporting documentation, if available."
      )
    ).toBe(true);
    expect(isDocumentUploadFillableQuestionText("Obtain copies of documentation")).toBe(true);
    expect(isDocumentUploadFillableQuestionText("Describe these meetings")).toBe(false);
  });

  it("validates single upload file shape", () => {
    expect(isAssessmentDocumentUploadFile(sampleFile)).toBe(true);
    expect(isAssessmentDocumentUploadFile({ fileKey: "x" })).toBe(false);
  });

  it("validates multi-file answers up to the limit", () => {
    const files = Array.from({ length: MAX_ASSESSMENT_QUESTION_UPLOADS }, (_, i) => ({
      ...sampleFile,
      fileKey: `${sampleFile.fileKey}-${i}`,
      fileName: `doc-${i}.pdf`,
    }));
    expect(isAssessmentDocumentUploadAnswer(files)).toBe(true);
    expect(
      isAssessmentDocumentUploadAnswer([
        ...files,
        { ...sampleFile, fileKey: "extra", fileName: "extra.pdf" },
      ])
    ).toBe(false);
  });

  it("normalizes legacy single-file answers to an array", () => {
    expect(normalizeAssessmentDocumentUploadAnswer(sampleFile)).toEqual([sampleFile]);
    expect(normalizeAssessmentDocumentUploadAnswer([sampleFile])).toEqual([sampleFile]);
    expect(normalizeAssessmentDocumentUploadAnswer(null)).toEqual([]);
  });

  it("matches assessment upload keys to user, assessment, and question", () => {
    const key = "assessment-uploads/user-1/asm-1/q-1/123-file.pdf";
    expect(keyMatchesAssessmentQuestionUpload(key, "user-1", "asm-1", "q-1")).toBe(true);
    expect(keyMatchesAssessmentQuestionUpload(key, "user-2", "asm-1", "q-1")).toBe(false);
  });

  it("flags skipped or empty document-upload answers for reviewers", () => {
    expect(
      documentUploadNeedsReviewerAttention("document-upload", null, true)
    ).toBe(true);
    expect(
      documentUploadNeedsReviewerAttention("document-upload", [], false)
    ).toBe(true);
    expect(
      documentUploadNeedsReviewerAttention("document-upload", [sampleFile], false)
    ).toBe(false);
    expect(hasDocumentUploadFiles([sampleFile])).toBe(true);
    expect(hasDocumentUploadFiles([])).toBe(false);
  });
});
