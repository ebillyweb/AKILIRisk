"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "react-hot-toast";

import { restartClientIntake } from "@/lib/actions/advisor-intake-restart-actions";
import { Button } from "@/components/ui/button";
import { SIDEBAR_ACTION_BTN } from "@/components/pipeline/sidebar-action-button";

type Props = {
  clientId: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function RestartIntakeButton({
  clientId,
  disabled = false,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (disabled) return;

    const confirmed = window.confirm(
      "Restart intake for this client? Their current intake answers — and any in-progress or completed assessment — will be archived. They start over from the beginning with the current questions, and you'll re-approve their intake before the new assessment unlocks.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await restartClientIntake({ clientId });
      if (!result.success) {
        toast.error(result.error ?? "Could not restart intake.");
        return;
      }
      toast.success("Intake restarted. The client can begin again with the current questions.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        className={SIDEBAR_ACTION_BTN}
        disabled={pending || disabled}
        onClick={handleClick}
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        {pending ? "Restarting intake…" : "Restart intake"}
      </Button>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
