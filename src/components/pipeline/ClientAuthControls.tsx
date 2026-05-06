"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [pending, startTransition] = useTransition();
  const [emailDraft, setEmailDraft] = useState(currentEmail);
  const [emailMessage, setEmailMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reissueMessage, setReissueMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function submitEmail() {
    setEmailMessage(null);
    if (emailDraft.trim() === currentEmail) {
      setEmailMessage({ kind: "ok", text: "Email unchanged." });
      return;
    }
    startTransition(async () => {
      const result = await reassignClientEmail({
        clientId,
        newEmail: emailDraft.trim(),
      });
      if (result.success) {
        setEmailMessage({
          kind: "ok",
          text: `Email updated to ${result.data.newEmail}.`,
        });
        router.refresh();
      } else {
        setEmailMessage({ kind: "err", text: result.error });
      }
    });
  }

  function submitReissue() {
    setReissueMessage(null);
    startTransition(async () => {
      const result = await reissueClientMagicLink({ clientId });
      if (result.success) {
        setReissueMessage({
          kind: "ok",
          text: `Sign-in link sent to ${result.data.email}.`,
        });
        router.refresh();
      } else {
        setReissueMessage({ kind: "err", text: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client sign-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email reassignment */}
        <div className="space-y-2">
          <Label htmlFor="client-email">Email address</Label>
          <p className="text-xs text-muted-foreground">
            Magic-link sign-ins go to this address. Updating it invalidates
            any in-flight links for the previous address.
          </p>
          <div className="flex gap-2">
            <Input
              id="client-email"
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              disabled={pending}
              className="flex-1"
            />
            <Button
              type="button"
              size="sm"
              onClick={submitEmail}
              disabled={pending || emailDraft.trim() === ""}
            >
              {pending ? "Saving…" : "Update email"}
            </Button>
          </div>
          {emailMessage && (
            <p
              className={`text-xs ${
                emailMessage.kind === "ok" ? "text-emerald-700" : "text-destructive"
              }`}
            >
              {emailMessage.text}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          {/* Re-issue magic link */}
          <Label className="text-sm">Sign-in link</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Send a fresh magic-link email to the address above. Existing
            links for this client are invalidated.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={submitReissue}
            disabled={pending}
          >
            {pending ? "Sending…" : "Re-issue magic link"}
          </Button>
          {reissueMessage && (
            <p
              className={`mt-2 text-xs ${
                reissueMessage.kind === "ok" ? "text-emerald-700" : "text-destructive"
              }`}
            >
              {reissueMessage.text}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
