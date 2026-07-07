'use client';

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Compact Back / Skip / Continue row shown at the TOP of a question, mirroring
 * the full NavigationButtons at the bottom. Reduces scrolling on long questions
 * and keeps navigation in reach. Wired to the same handlers as the bottom bar.
 */
interface QuestionQuickNavProps {
  onBack: () => void;
  onSkip?: () => void;
  onNext: () => void | Promise<void>;
  canGoBack: boolean;
  isLastQuestion: boolean;
  isSaving: boolean;
  /** Show the Skip control (matches the in-card skip availability). */
  showSkip: boolean;
}

export function QuestionQuickNav({
  onBack,
  onSkip,
  onNext,
  canGoBack,
  isLastQuestion,
  isSaving,
  showSkip,
}: QuestionQuickNavProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onBack}
        disabled={!canGoBack || isSaving}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center gap-2">
        {showSkip && onSkip ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={onNext} disabled={isSaving}>
          {isLastQuestion ? "Complete section" : "Continue"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
