"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "react-hot-toast";

import { restartClientIntake } from "@/lib/actions/advisor-intake-restart-actions";
import { Button } from "@/components/ui/button";

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
      "Restart intake for this client? Their current answers will be archived and they will start the updated question set from the beginning.",
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
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start"
      disabled={pending || disabled}
      title={disabled ? disabledReason : undefined}
      onClick={handleClick}
    >
      <RotateCcw className="mr-2 h-4 w-4" />
      {pending ? "Restarting intake…" : "Restart intake"}
    </Button>
  );
}
