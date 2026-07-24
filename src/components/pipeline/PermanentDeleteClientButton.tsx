"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { permanentlyDeleteClientByAdmin } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { SIDEBAR_ACTION_BTN } from "@/components/pipeline/sidebar-action-button";

type Props = {
  clientId: string;
  clientName?: string;
};

export function PermanentDeleteClientButton({ clientId, clientName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const displayName = clientName || "this client";

  function handleDelete() {
    if (
      !window.confirm(
        `PERMANENTLY DELETE ${displayName}? This will remove all their data including assessments, intakes, and assignments. This action CANNOT be undone.`
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Are you absolutely sure? Click OK to confirm permanent deletion."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await permanentlyDeleteClientByAdmin({ userId: clientId });
      if (!res.success) {
        toast.error(res.error ?? "Could not delete client.");
        return;
      }
      toast.success("Client permanently deleted.");
      router.push("/advisor/pipeline");
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      className={SIDEBAR_ACTION_BTN}
      disabled={pending}
      onClick={handleDelete}
    >
      <Trash2 className="h-3.5 w-3.5 shrink-0" />
      Delete permanently
    </Button>
  );
}
