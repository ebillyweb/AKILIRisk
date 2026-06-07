import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  dateAnswerNeedsReviewerAttention,
  STALE_DATE_THRESHOLD_MONTHS,
} from "@/lib/assessment/question-date";

type StaleDateReviewerFlagProps = {
  questionType: string | undefined;
  answer: unknown;
};

/** Highlights date answers more than 12 months in the past. */
export function StaleDateReviewerFlag({
  questionType,
  answer,
}: StaleDateReviewerFlagProps) {
  if (!dateAnswerNeedsReviewerAttention(questionType, answer)) {
    return null;
  }

  return (
    <Badge variant="warning" className="gap-1">
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      Over {STALE_DATE_THRESHOLD_MONTHS} months ago
    </Badge>
  );
}
