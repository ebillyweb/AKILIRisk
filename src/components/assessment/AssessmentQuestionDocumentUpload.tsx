"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/documents/types";
import type { AssessmentDocumentUploadAnswer } from "@/lib/assessment/question-upload";
import { isAssessmentDocumentUploadAnswer } from "@/lib/assessment/question-upload";

interface AssessmentQuestionDocumentUploadProps {
  assessmentId: string;
  questionId: string;
  value: AssessmentDocumentUploadAnswer | null;
  onChange: (answer: AssessmentDocumentUploadAnswer) => void;
}

type UploadState =
  | { status: "idle" }
  | { status: "requesting-url" }
  | { status: "uploading" }
  | { status: "confirming" }
  | { status: "success" }
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

export function AssessmentQuestionDocumentUpload({
  assessmentId,
  questionId,
  value,
  onChange,
}: AssessmentQuestionDocumentUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>(
    value ? { status: "success" } : { status: "idle" }
  );

  const onDropAccepted = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        setUploadState({ status: "requesting-url" });

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

        setUploadState({ status: "uploading" });

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

        setUploadState({ status: "confirming" });

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

        const answer: unknown = await confirmResponse.json();
        if (!isAssessmentDocumentUploadAnswer(answer)) {
          throw new Error("Invalid upload confirmation response");
        }

        onChange(answer);
        setUploadState({ status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setUploadState({ status: "error", message });
      }
    },
    [assessmentId, questionId, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted,
    accept: ALLOWED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: uploadState.status !== "idle" && uploadState.status !== "error",
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection?.errors[0]?.code === "file-too-large") {
        setUploadState({
          status: "error",
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        });
      } else if (rejection?.errors[0]?.code === "file-invalid-type") {
        setUploadState({
          status: "error",
          message: "Invalid file type. Please upload PDF, PNG, or JPG files only.",
        });
      } else {
        setUploadState({
          status: "error",
          message: "File rejected. Please check file type and size.",
        });
      }
    },
  });

  const showDropzone =
    uploadState.status === "idle" ||
    uploadState.status === "error" ||
    (uploadState.status === "success" && !value);

  const renderContent = () => {
    if (value && uploadState.status === "success") {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircle2 className="mb-4 size-10 text-green-600" />
          <p className="text-sm font-medium text-green-700">Document uploaded</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4 shrink-0" aria-hidden />
            {value.fileName}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              setUploadState({ status: "idle" });
            }}
          >
            Replace file
          </Button>
        </div>
      );
    }

    switch (uploadState.status) {
      case "idle":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Upload className="mb-4 size-10 text-muted-foreground" />
            <p className="text-sm text-center">
              <span className="font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="mt-2 text-xs text-muted-foreground">PDF, PNG, JPG up to 10MB</p>
          </div>
        );
      case "requesting-url":
      case "uploading":
      case "confirming":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="mb-4 size-10 animate-spin text-primary" />
            <p className="text-sm text-center">
              {uploadState.status === "requesting-url"
                ? "Preparing upload…"
                : uploadState.status === "uploading"
                  ? "Uploading…"
                  : "Confirming…"}
            </p>
          </div>
        );
      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="mb-4 size-10 text-red-600" />
            <p className="mb-4 text-center text-sm text-red-700">{uploadState.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setUploadState({ status: "idle" });
              }}
            >
              Try again
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!showDropzone && value) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 border-dashed border-green-500 bg-green-50/50 dark:bg-green-950/20"
        )}
      >
        {renderContent()}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        "hover:border-primary/50 hover:bg-primary/5",
        isDragActive && "border-primary bg-primary/5",
        uploadState.status === "error" && "border-red-500 bg-red-50/50",
        uploadState.status !== "idle" &&
          uploadState.status !== "error" &&
          "cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      {renderContent()}
    </div>
  );
}
