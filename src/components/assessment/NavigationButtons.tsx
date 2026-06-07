'use client';

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * Navigation Buttons Component
 *
 * Back, Next, and Skip controls for assessment flow.
 * Handles validation states and loading indicators.
 */

interface NavigationButtonsProps {
  onBack: () => void;
  onNext: () => void | Promise<void>;
  canGoBack: boolean;
  isLastQuestion: boolean;
  isValid: boolean;
  isSaving: boolean;
}

export function NavigationButtons({
  onBack,
  onNext,
  canGoBack,
  isLastQuestion,
  isValid: _isValid,
  isSaving,
}: NavigationButtonsProps) {
  return (
    <div className="flex flex-col gap-4 border-t section-divider pt-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="order-2 sm:order-1">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={!canGoBack || isSaving}
          className="w-full sm:min-w-[140px]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="order-1 flex min-h-6 items-center justify-center gap-2 sm:order-2">
        {isSaving ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        ) : null}
      </div>

      <div className="order-3">
        <Button
          onClick={onNext}
          disabled={isSaving}
          className="w-full sm:min-w-[160px]"
        >
          {isLastQuestion ? (
            <>
              Complete Section
              <ChevronRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
