"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { completeInvitationSignup } from "@/lib/actions/invitation-signup-actions";
import { InviteAcceptFailure } from "@/components/auth/InviteAcceptFailure";

type SignupInviteProcessorProps = {
  inviteCodeId: string;
  token: string;
  callbackUrl?: string;
};

/**
 * Records invitation opened (US-5) then completes signup via server action.
 */
export function SignupInviteProcessor({
  inviteCodeId,
  token,
  callbackUrl,
}: SignupInviteProcessorProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await fetch(`/api/invitations/${inviteCodeId}/opened`, {
          method: "POST",
        });
      } catch {
        // Fire-and-forget: accept flow also marks OPENED server-side.
      }

      const result = await completeInvitationSignup(token, callbackUrl);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [inviteCodeId, token, callbackUrl]);

  if (error) {
    return <InviteAcceptFailure message={error} />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Setting up your account…</p>
    </div>
  );
}
