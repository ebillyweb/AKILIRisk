"use client";

import { useTransition } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { restoreClientByAdmin, softDeleteClientByAdmin } from "@/lib/admin/actions";

type Props = {
  clientId: string;
  deactivated: boolean;
};

export function AdminClientAccountActions({ clientId, deactivated }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {deactivated ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreClientByAdmin({ userId: clientId });
              if (!res.success) toast.error(res.error ?? "Could not restore client.");
              else toast.success("Client restored.");
            })
          }
        >
          Restore client
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Deactivate this client account? Active advisor assignments will be set to inactive."
              )
            ) {
              return;
            }
            startTransition(async () => {
              const res = await softDeleteClientByAdmin({ userId: clientId });
              if (!res.success) toast.error(res.error ?? "Could not deactivate client.");
              else toast.success("Client deactivated.");
            });
          }}
        >
          Deactivate
        </Button>
      )}
    </div>
  );
}
