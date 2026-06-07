"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, Loader2, FileText, X } from "lucide-react";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/documents/types";
import type {
  AssessmentDocumentUploadAnswer,
  AssessmentDocumentUploadFile,
} from "@/lib/assessment/question-upload";
import {
  isAssessmentDocumentUploadFile,
  MAX_ASSESSMENT_QUESTION_UPLOADS,
  normalizeAssessmentDocumentUploadAnswer,
} from "@/lib/assessment/question-upload";

interface AssessmentQuestionDocumentUploadProps {
  assessmentId: string;
  questionId: string;
  value: unknown;
  onChange: (answer: AssessmentDocumentUploadAnswer) => void;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; current: number; total: number }
  | { status: "error"; message: string };

async function parseS3ErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const m = text.match(/<Message>([^<]*)<\/Message>/);
    if (m?.[1]) return m[1].trim();
    if (text.trim()) return text.trim().slice(0, 280);
  } catch {
    /* ignore */
  }
  return "";
}

async function uploadSingleFile(
  assessmentId: string,
  questionId: string,
  file: File
): Promise<AssessmentDocumentUploadFile> {
  const urlResponse = await fetch(
    `/api/assessment/${assessmentId}/question-upload/url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    }
  );

  if (!urlResponse.ok) {
    const errorData = await urlResponse.text();
    throw new Error(errorData || "Failed to get upload URL");
  }

  const payload = await urlResponse.json();
  const signedUrl = typeof payload.signedUrl === "string" ? payload.signedUrl : "";
  const key = typeof payload.key === "string" ? payload.key : "";
  const contentType = payload.contentType;
  if (!signedUrl || !key) {
    throw new Error("Invalid response from upload URL service");
  }

  const putContentType =
    typeof contentType === "string" && contentType.length > 0
      ? contentType
      : file.type || "application/octet-stream";

  const s3Response = await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": putContentType },
  });

  if (!s3Response.ok) {
    const detail = await parseS3ErrorBody(s3Response);
    const suffix = detail ? `: ${detail}` : "";
    throw new Error(
      `Storage upload failed (${s3Response.status || "network"})${suffix}`
    );
  }

  const confirmResponse = await fetch(
    `/api/assessment/${assessmentId}/question-upload/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        key,
        fileName: file.name,
      }),
    }
  );

  if (!confirmResponse.ok) {
    const errorData = await confirmResponse.text();
    throw new Error(errorData || "Failed to confirm upload");
  }

  const confirmed: unknown = await confirmResponse.json();
  if (!isAssessmentDocumentUploadFile(confirmed)) {
    throw new Error("Invalid upload confirmation response");
  }

  return confirmed;
}

export function AssessmentQuestionDocumentUpload({
  assessmentId,
  questionId,
  value,
  onChange,
}: AssessmentQuestionDocumentUploadProps) {
  const files = normalizeAssessmentDocumentUploadAnswer(value);
  const remainingSlots = MAX_ASSESSMENT_QUESTION_UPLOADS - files.length;
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });

  const onDropAccepted = useCallback(
    async (acceptedFiles: File[]) => {
      if (remainingSlots <= 0 || acceptedFiles.length === 0) return;

      const toUpload = acceptedFiles.slice(0, remainingSlots);

      try {
        const nextFiles = [...files];
        for (let i = 0; i < toUpload.length; i++) {
          setUploadState({ status: "uploading", current: i + 1, total: toUpload.length });
          const confirmed = await uploadSingleFile(
            assessmentId,
            questionId,
            toUpload[i]!
          );
          nextFiles.push(confirmed);
        }
        onChange(nextFiles);
        setUploadState({ status: "idle" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setUploadState({ status: "error", message });
      }
    },
    [assessmentId, questionId, files, onChange, remainingSlots]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted,
    accept: ALLOWED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: remainingSlots,
    multiple: remainingSlots > 1,
    disabled: remainingSlots <= 0 || uploadState.status === "uploading",
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection?.errors[0]?.code === "file-too-large") {
        setUploadState({
          status: "error",
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB per file.`,
        });
      } else if (rejection?.errors[0]?.code === "file-invalid-type") {
        setUploadState({
          status: "error",
          message: "Invalid file type. Please upload PDF, PNG, or JPG files only.",
        });
      } else if (rejection?.errors[0]?.code === "too-many-files") {
        setUploadState({
          status: "error",
          message: `You can upload up to ${MAX_ASSESSMENT_QUESTION_UPLOADS} documents.`,
        });
      } else {
        setUploadState({
          status: "error",
          message: "File rejected. Please check file type and size.",
        });
      }
    },
  });

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
    setUploadState({ status: "idle" });
  };

  return (
    <div className="space-y-4">
      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={file.fileKey}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{file.fileName}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeFile(index)}
                disabled={uploadState.status === "uploading"}
                aria-label={`Remove ${file.fileName}`}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {remainingSlots > 0 ? (
        <div
          {...getRootProps()}
          className={cn(
            "rounded-lg border-2 border-dashed cursor-pointer transition-colors",
            "hover:border-primary/50 hover:bg-primary/5",
            isDragActive && "border-primary bg-primary/5",
            uploadState.status === "error" && "border-red-500 bg-red-50/50",
            uploadState.status === "uploading" && "cursor-not-allowed opacity-70"
          )}
        >
          <input {...getInputProps()} />
          {uploadState.status === "uploading" ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="mb-4 size-10 animate-spin text-primary" />
              <p className="text-sm text-center">
                Uploading {uploadState.current} of {uploadState.total}…
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Upload className="mb-4 size-10 text-muted-foreground" />
              <p className="text-sm text-center">
                <span className="font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                PDF, PNG, or JPG up to 10MB each · {remainingSlots} of{" "}
                {MAX_ASSESSMENT_QUESTION_UPLOADS} remaining
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Maximum of {MAX_ASSESSMENT_QUESTION_UPLOADS} documents reached. Remove a file to
          upload a different one.
        </p>
      )}

      {uploadState.status === "error" ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p>{uploadState.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setUploadState({ status: "idle" })}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
