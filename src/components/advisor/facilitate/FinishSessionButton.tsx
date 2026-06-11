"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { finishFacilitatedSession } from "@/lib/actions/facilitated-session-actions";

interface FinishSessionButtonProps {
  sessionId: string;
}

export function FinishSessionButton({ sessionId }: FinishSessionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleFinish = () => {
    startTransition(async () => {
      const result = await finishFacilitatedSession(sessionId);
      if (result.success) {
        toast.success("Session complete — client is ready for profile review");
        router.push(result.redirectTo);
        return;
      }
      toast.error(result.error ?? "Could not finish session");
    });
  };

  return (
    <Button type="button" size="lg" disabled={isPending} onClick={handleFinish}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        "Finish session"
      )}
    </Button>
  );
}
