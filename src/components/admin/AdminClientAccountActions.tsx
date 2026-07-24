"use client";

import { useTransition } from "react";
import { toast } from "react-hot-toast";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  restoreClientByAdmin,
  softDeleteClientByAdmin,
  permanentlyDeleteClientByAdmin,
} from "@/lib/admin/actions";

type Props = {
  clientId: string;
  deactivated: boolean;
  isSuperAdmin?: boolean;
};

export function AdminClientAccountActions({ clientId, deactivated, isSuperAdmin = false }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {deactivated ? (
        <>
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
          {isSuperAdmin && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    "PERMANENTLY DELETE this client? This will remove all their data including assessments, intakes, and assignments. This action CANNOT be undone."
                  )
                ) {
                  return;
                }
                if (
                  !window.confirm(
                    "Are you absolutely sure? Type 'DELETE' in your mind and click OK to confirm permanent deletion."
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  const res = await permanentlyDeleteClientByAdmin({ userId: clientId });
                  if (!res.success) toast.error(res.error ?? "Could not delete client.");
                  else toast.success("Client permanently deleted.");
                });
              }}
            >
              <Trash2 className="mr-1 size-3.5" />
              Delete permanently
            </Button>
          )}
        </>
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
