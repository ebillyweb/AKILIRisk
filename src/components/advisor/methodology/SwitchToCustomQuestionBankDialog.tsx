"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type QuestionBankKind = "intake" | "assessment";

const COPY: Record<
  QuestionBankKind,
  {
    title: (scopeLabel: string) => string;
    savedCustom: (count: number, scopeLabel: string) => string;
    firstTime: (scopeLabel: string) => string;
    bullets: string[];
    footer: string;
  }
> = {
  intake: {
    title: (scope) => `Add custom intake questions to ${scope} platform set?`,
    savedCustom: (count, scope) =>
      `You have ${count} saved custom question${count === 1 ? "" : "s"}. Adding this question will include ${scope} custom prompts after the platform intake questions.`,
    firstTime: (scope) =>
      `Adding a custom question will include it after ${scope} platform intake questions for new clients.`,
    bullets: [
      "Platform intake questions stay in place and appear first",
      "Your new question is added after the platform set",
      "Applies to new intakes only — clients in progress keep their current script",
    ],
    footer: "You can switch to platform-only or custom-only anytime from this page.",
  },
  assessment: {
    title: (scope) => `Add custom assessment questions to ${scope} platform set?`,
    savedCustom: (count, scope) =>
      `You have ${count} saved custom question${count === 1 ? "" : "s"} across risk domains. Adding this question will include ${scope} custom prompts after the platform questions in each domain.`,
    firstTime: (scope) =>
      `Adding a custom question will include it after ${scope} platform assessment questions for new clients.`,
    bullets: [
      "Platform assessment questions stay in place and appear first",
      "Your new question is added after the platform set for this risk domain",
      "Applies to new assessments only — in-progress clients keep their current snapshot",
    ],
    footer: "You can switch to platform-only or custom-only anytime from this page.",
  },
};

type SwitchToCombinedQuestionBankDialogProps = {
  bankKind: QuestionBankKind;
  open: boolean;
  pending: boolean;
  savedCustomQuestionCount: number;
  firmScope?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function SwitchToCombinedQuestionBankDialog({
  bankKind,
  open,
  pending,
  savedCustomQuestionCount,
  firmScope = false,
  onOpenChange,
  onConfirm,
}: SwitchToCombinedQuestionBankDialogProps) {
  const hasSavedCustom = savedCustomQuestionCount > 0;
  const scopeLabel = firmScope ? "the firm" : "your";
  const copy = COPY[bankKind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{copy.title(scopeLabel)}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              {hasSavedCustom ? (
                <p>{copy.savedCustom(savedCustomQuestionCount, scopeLabel)}</p>
              ) : (
                <p>{copy.firstTime(scopeLabel)}</p>
              )}
              <ul className="list-disc space-y-1 pl-5">
                {copy.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <p>{copy.footer}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? "Adding…" : "Add to combined set"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use SwitchToCombinedQuestionBankDialog */
export function SwitchToCustomQuestionBankDialog(
  props: SwitchToCombinedQuestionBankDialogProps,
) {
  return <SwitchToCombinedQuestionBankDialog {...props} />;
}

/** @deprecated Use SwitchToCombinedQuestionBankDialog with bankKind="intake" */
export function SwitchToCustomIntakeBankDialog(
  props: Omit<SwitchToCombinedQuestionBankDialogProps, "bankKind">,
) {
  return <SwitchToCombinedQuestionBankDialog bankKind="intake" {...props} />;
}
