"use client";

import { useState, useTransition } from "react";
import { assignClientBySuperAdminAction } from "@/lib/admin/client-assignment-actions";
import type { ClientAssignmentTargetGroup } from "@/lib/admin/client-assignment-queries";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "__unassigned";

export function AdminClientAssignSelect({
  clientId,
  targetGroups,
}: {
  clientId: string;
  targetGroups: ClientAssignmentTargetGroup[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (targetGroups.every((group) => group.options.length === 0)) {
    return (
      <p className="text-xs text-muted-foreground">No advisors or enterprises available</p>
    );
  }

  return (
    <div className="flex min-w-[200px] flex-col gap-1 sm:min-w-[240px]">
      <Select
        disabled={pending}
        onValueChange={(target) => {
          if (target === UNASSIGNED) return;
          setError(null);
          startTransition(async () => {
            const result = await assignClientBySuperAdminAction({ clientId, target });
            if (!result.success) {
              setError(result.error);
            }
          });
        }}
      >
        <SelectTrigger className="w-full" aria-label="Assign client to advisor or enterprise">
          <SelectValue placeholder="Assign…" />
        </SelectTrigger>
        <SelectContent>
          {targetGroups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
