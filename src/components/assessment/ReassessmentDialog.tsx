"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { startReassessmentAction } from "@/lib/actions/reassessment-actions";
import type { ReassessmentType } from "@/lib/assessment/reassessment-types";
import { REASSESSMENT_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReassessmentDialogProps {
  assessmentId: string;
  targetedQuestionCount: number;
  triggerLabel?: string;
  onReassessmentStarted?: (newAssessmentId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PILLAR_OPTIONS = [
  { value: "governance", label: "Governance" },
  { value: "cyber-digital", label: "Cyber & Digital" },
  { value: "identity", label: "Identity" },
  { value: "estate", label: "Estate" },
  { value: "insurance", label: "Insurance" },
  { value: "physical-security", label: "Physical Security" },
  { value: "tax", label: "Tax" },
  { value: "liquidity", label: "Liquidity" },
  { value: "behavioral", label: "Behavioral" },
  { value: "reputational-social", label: "Reputational & Social" },
] as const;

type OptionDef = {
  type: ReassessmentType;
  title: string;
  description: string;
};

const TYPE_OPTIONS: OptionDef[] = [
  {
    type: "full",
    title: "Full Assessment",
    description: "Annual review or major life event",
  },
  {
    type: "pillar",
    title: "Domain / Pillar Reassessment",
    description: "Retake a single pillar",
  },
  {
    type: "targeted",
    title: "Targeted Follow-up",
    description: "Re-ask questions linked to completed recommendations",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReassessmentDialog({
  assessmentId,
  targetedQuestionCount,
  triggerLabel = REASSESSMENT_COPY.startButton,
  onReassessmentStarted,
}: ReassessmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReassessmentType | null>(
    null,
  );
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isTargetedDisabled = targetedQuestionCount === 0;

  const canSubmit =
    selectedType !== null &&
    (selectedType !== "pillar" || selectedPillar !== null) &&
    !isPending;

  function handleTypeSelect(type: ReassessmentType) {
    if (type === "targeted" && isTargetedDisabled) return;
    setSelectedType(type);
    setError(null);
    if (type !== "pillar") setSelectedPillar(null);
  }

  function handleBegin() {
    if (!selectedType) return;
    setError(null);

    startTransition(async () => {
      const result = await startReassessmentAction({
        previousAssessmentId: assessmentId,
        type: selectedType,
        includedPillars: selectedPillar ? [selectedPillar] : undefined,
      });

      if (result.success) {
        setOpen(false);
        setSelectedType(null);
        setSelectedPillar(null);
        onReassessmentStarted?.(result.data.id);
      } else {
        setError(
          result.error ??
            "Could not start reassessment. Please try again or contact support.",
        );
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSelectedType(null);
      setSelectedPillar(null);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{REASSESSMENT_COPY.dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {TYPE_OPTIONS.map((opt) => {
            const isSelected = selectedType === opt.type;
            const isDisabled =
              opt.type === "targeted" && isTargetedDisabled;

            const card = (
              <button
                key={opt.type}
                type="button"
                disabled={isDisabled}
                onClick={() => handleTypeSelect(opt.type)}
                className={cn(
                  "w-full text-left rounded-lg border p-4 transition-colors",
                  "min-h-[44px]",
                  isSelected && "border-l-2 border-l-accent bg-accent/5",
                  isDisabled && "opacity-50 cursor-not-allowed",
                  !isSelected && !isDisabled && "hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  {opt.type === "targeted" && (
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      {targetedQuestionCount} eligible questions
                    </Badge>
                  )}
                </div>

                {/* Inline pillar selector for pillar type */}
                {opt.type === "pillar" && isSelected && (
                  <div
                    className="mt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={selectedPillar ?? ""}
                      onValueChange={setSelectedPillar}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a pillar" />
                      </SelectTrigger>
                      <SelectContent>
                        {PILLAR_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </button>
            );

            // Wrap disabled targeted option in tooltip
            if (isDisabled) {
              return (
                <TooltipProvider key={opt.type}>
                  <Tooltip>
                    <TooltipTrigger asChild>{card}</TooltipTrigger>
                    <TooltipContent>
                      <p>
                        No completed recommendations with linked questions yet
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return card;
          })}
        </div>

        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}

        <div className="mt-4 space-y-2">
          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={handleBegin}
          >
            {isPending ? "Starting..." : "Begin Reassessment"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Previous assessment is preserved. This starts a new version.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
