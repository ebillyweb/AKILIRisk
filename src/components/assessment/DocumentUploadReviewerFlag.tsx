import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { documentUploadNeedsReviewerAttention } from "@/lib/assessment/question-upload";

type DocumentUploadReviewerFlagProps = {
  questionType: string | undefined;
  answer: unknown;
  skipped: boolean;
};

/** Highlights document-attachment questions where the client skipped or provided no files. */
export function DocumentUploadReviewerFlag({
  questionType,
  answer,
  skipped,
}: DocumentUploadReviewerFlagProps) {
  if (!documentUploadNeedsReviewerAttention(questionType, answer, skipped)) {
    return null;
  }

  return (
    <Badge variant="warning" className="gap-1">
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      No documents provided
    </Badge>
  );
}
