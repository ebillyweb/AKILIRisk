"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "react-hot-toast";

import { setClientAssignmentStatus } from "@/lib/actions/advisor-client-assignment-actions";
import { Button } from "@/components/ui/button";
import type { AssignmentStatus } from "@prisma/client";

type Props = {
  clientId: string;
  status: AssignmentStatus;
};

export function ClientWorkflowStatusControls({ clientId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isActive = status === "ACTIVE";

  function run(nextStatus: AssignmentStatus) {
    const confirmMessage =
      nextStatus === "INACTIVE"
        ? "End your workflow with this client? They leave your active pipeline only — their account and history are kept, and other advisors’ assignments are unchanged. You can restore your workflow later."
        : "Restore this client to your active pipeline? This only reactivates your assignment with them.";

    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const result = await setClientAssignmentStatus({ clientId, status: nextStatus });
      if (!result.success) {
        toast.error(result.error ?? "Could not update workflow status.");
        return;
      }
      toast.success(
        nextStatus === "INACTIVE"
          ? "Your workflow with this client ended."
          : "Client restored to your pipeline.",
      );
      router.refresh();
      if (nextStatus === "INACTIVE") {
        router.push("/advisor/pipeline?inactive=1");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={isActive ? "destructive" : "default"}
      className="w-full justify-start text-xs sm:text-sm"
      disabled={pending}
      onClick={() => run(isActive ? "INACTIVE" : "ACTIVE")}
    >
      {isActive ? (
        <>
          <Archive className="mr-2 h-4 w-4" />
          End workflow
        </>
      ) : (
        <>
          <ArchiveRestore className="mr-2 h-4 w-4" />
          Restore to pipeline
        </>
      )}
    </Button>
  );
}
