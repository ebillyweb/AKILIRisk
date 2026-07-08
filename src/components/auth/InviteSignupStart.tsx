"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  startInvitedSignupAction,
  type StartInvitedSignupState,
} from "@/lib/actions/invitation-signup-actions";

/**
 * Invited-client landing shown on the `/signup?invite=…` GET. The GET itself has
 * no auth side effects; clicking "Start your assessment" runs the server action
 * that provisions the account (first visit) or logs the client back in
 * (subsequent visits) and forwards to the assessment. This avoids the
 * confusing second magic-link/code step and is robust to email link-scanners.
 */
export function InviteSignupStart({
  inviteToken,
  callbackUrl,
  clientName,
}: {
  inviteToken: string;
  callbackUrl?: string;
  clientName?: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    StartInvitedSignupState,
    FormData
  >(startInvitedSignupAction, {});

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {clientName ? `Welcome, ${clientName}` : "You're invited"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your advisor has invited you to complete your confidential family Risk
          Profile. Click below to begin — no password needed.
        </p>
      </div>

      <form action={formAction} className="w-full">
        <input type="hidden" name="invite" value={inviteToken} />
        {callbackUrl ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Starting…" : "Start your assessment"}
        </Button>
      </form>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        This secure link is unique to you and expires in 7 days.
      </p>
    </div>
  );
}
