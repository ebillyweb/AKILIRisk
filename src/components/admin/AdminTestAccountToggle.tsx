"use client";

import { useTransition } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { setUserTestAccountBySuperAdmin } from "@/lib/admin/actions";

type Props = {
  userId: string;
  isTestAccount: boolean;
  accountLabel: "client" | "advisor";
};

export function AdminTestAccountToggle({ userId, isTestAccount, accountLabel }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={isTestAccount ? "secondary" : "outline"}
      disabled={pending}
      onClick={() => {
        const next = !isTestAccount;
        const message = next
          ? `Mark this ${accountLabel} as a test account? Their activity will be excluded from platform dashboards.`
          : `Remove test account flag from this ${accountLabel}? They will count in platform dashboards again.`;
        if (!window.confirm(message)) return;

        startTransition(async () => {
          const res = await setUserTestAccountBySuperAdmin({
            userId,
            isTestAccount: next,
          });
          if (!res.success) {
            toast.error(res.error ?? "Could not update test account flag.");
            return;
          }
          toast.success(
            next ? "Marked as test account." : "Removed test account flag.",
          );
        });
      }}
    >
      {isTestAccount ? "Clear test account" : "Mark test account"}
    </Button>
  );
}
