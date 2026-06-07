import { describe, expect, it } from "vitest";
import {
  isAssessmentDocumentUploadAnswer,
  isDocumentUploadFillableQuestionText,
  keyMatchesAssessmentQuestionUpload,
} from "./question-upload";

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

  it("validates upload answer shape", () => {
    expect(
      isAssessmentDocumentUploadAnswer({
        fileKey: "assessment-uploads/u/a/q/file.pdf",
        fileName: "charter.pdf",
        fileSize: 1024,
        fileMimeType: "application/pdf",
      })
    ).toBe(true);
    expect(isAssessmentDocumentUploadAnswer({ fileKey: "x" })).toBe(false);
  });

  it("matches assessment upload keys to user, assessment, and question", () => {
    const key = "assessment-uploads/user-1/asm-1/q-1/123-file.pdf";
    expect(keyMatchesAssessmentQuestionUpload(key, "user-1", "asm-1", "q-1")).toBe(true);
    expect(keyMatchesAssessmentQuestionUpload(key, "user-2", "asm-1", "q-1")).toBe(false);
  });
});
