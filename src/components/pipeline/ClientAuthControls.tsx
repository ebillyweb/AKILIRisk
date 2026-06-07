"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mail, Send, AlertCircle } from "lucide-react";
import {
  reassignClientEmail,
  reissueClientMagicLink,
} from "@/lib/actions/advisor-client-auth-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientAuthControlsProps {
  clientId: string;
  /** Current email displayed on the form. */
  currentEmail: string;
}

type FeedbackMessage =
  | { kind: "ok"; title: string; detail?: string }
  | { kind: "err"; title: string; detail?: string };

function AuthFeedback({ message }: { message: FeedbackMessage }) {
  const isOk = message.kind === "ok";
  return (
    <div
      role="status"
      className={
        isOk
          ? "rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-900 dark:text-emerald-100"
          : "rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      }
    >
      <div className="flex gap-2">
        {isOk ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium leading-snug">{message.title}</p>
          {message.detail ? (
            <p className="break-all text-xs leading-snug opacity-90">{message.detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Round-11 commit 4 (BRD §5.1.AUTH): advisor-side controls for client
 * authentication. Two actions:
 *   1. Update email — replaces the User.email value, invalidates prior
 *      magic-link tokens, audits.
 *   2. Re-issue magic link — issues a fresh token + sends email, audits.
 *
 * Both actions are advisor-only and gated through ClientAdvisorAssignment.
 * Admin-equivalent controls live on the admin pages (out of scope for
 * this commit).
 */
export function ClientAuthControls({ clientId, currentEmail }: ClientAuthControlsProps) {
  const router = useRouter();
  const [emailPending, startEmailTransition] = useTransition();
  const [reissuePending, startReissueTransition] = useTransition();
  const [emailDraft, setEmailDraft] = useState(currentEmail);
  const [emailMessage, setEmailMessage] = useState<FeedbackMessage | null>(null);
  const [reissueMessage, setReissueMessage] = useState<FeedbackMessage | null>(null);

  function submitEmail() {
    setEmailMessage(null);
    if (emailDraft.trim() === currentEmail) {
      setEmailMessage({ kind: "ok", title: "Email unchanged." });
      return;
    }
    startEmailTransition(async () => {
      const result = await reassignClientEmail({
        clientId,
        newEmail: emailDraft.trim(),
      });
      if (result.success) {
        setEmailMessage({
          kind: "ok",
          title: "Email updated",
          detail: result.data.newEmail,
        });
        router.refresh();
      } else {
        setEmailMessage({ kind: "err", title: result.error });
      }
    });
  }

  function submitReissue() {
    setReissueMessage(null);
    startReissueTransition(async () => {
      const result = await reissueClientMagicLink({ clientId });
      if (result.success) {
        setReissueMessage({
          kind: "ok",
          title: "Sign-in link sent",
          detail: result.data.email,
        });
        router.refresh();
      } else {
        setReissueMessage({ kind: "err", title: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Client sign-in</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Manage where magic-link emails are sent and resend a fresh sign-in link.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email reassignment — stacked for narrow sidebar column */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="client-email" className="text-sm font-medium">
              Email address
            </Label>
            <p className="text-sm text-muted-foreground leading-snug">
              Magic-link sign-ins go to this address. Changing it invalidates
              any in-flight links for the previous address.
            </p>
          </div>
          <Input
            id="client-email"
            type="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            disabled={emailPending || reissuePending}
            className="w-full"
          />
          <Button
            type="button"
            className="w-full justify-center"
            onClick={submitEmail}
            disabled={emailPending || reissuePending || emailDraft.trim() === ""}
          >
            <Mail className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {emailPending ? "Saving…" : "Update email"}
          </Button>
          {emailMessage ? <AuthFeedback message={emailMessage} /> : null}
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Sign-in link</Label>
            <p className="text-sm text-muted-foreground leading-snug">
              Send a fresh magic-link email to the address above. Existing
              links for this client are invalidated.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={submitReissue}
            disabled={emailPending || reissuePending}
          >
            <Send className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {reissuePending ? "Sending…" : "Re-issue magic link"}
          </Button>
          {reissueMessage ? <AuthFeedback message={reissueMessage} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
