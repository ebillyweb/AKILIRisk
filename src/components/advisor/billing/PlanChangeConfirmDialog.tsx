"use client";

import { Check } from "lucide-react";

import type { PlanChangeExplainer } from "@/lib/billing/plan-change-explainer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PlanChangeConfirmDialogProps = {
  explainer: PlanChangeExplainer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  confirmDisabled?: boolean;
};

export function PlanChangeConfirmDialog({
  explainer,
  open,
  onOpenChange,
  onConfirm,
  pending = false,
  confirmDisabled = false,
}: PlanChangeConfirmDialogProps) {
  if (!explainer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{explainer.title}</DialogTitle>
          <DialogDescription className="text-left leading-6">
            {explainer.summary}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5">
          {explainer.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex gap-2 text-sm leading-6 text-muted-foreground"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {explainer.warning ? (
          <Alert variant="warning">
            <AlertDescription>{explainer.warning}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {pending ? "Processing…" : explainer.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
