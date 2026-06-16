"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { broadcastAuthSessionChange } from "@/lib/auth/session-sync";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Settings control to disable MFA. Requires re-authentication with a current
 * authenticator code (or recovery code), then refreshes the session so the JWT
 * recomputes to the unchallenged state immediately.
 */
export function DisableMfaControl() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [open, setOpen] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useRecovery ? { recoveryCode: value } : { token: value }
        ),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to disable MFA");
      }

      // Re-mint the JWT so mfaEnabled flips to false right away, then notify
      // other tabs and refresh the page to show the disabled state.
      await updateSession();
      broadcastAuthSessionChange();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable MFA");
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
        <p className="editorial-kicker">Disable MFA</p>
        <p className="mt-2 text-sm font-semibold">Turn off two-factor authentication</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Removes the second factor from your account. You&apos;ll be asked to
          confirm with a current code.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          Disable MFA
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
      <p className="editorial-kicker">Disable MFA</p>
      <p className="mt-2 text-sm font-semibold">Confirm to disable</p>
      <form onSubmit={handleDisable} className="mt-3 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="mfa-disable-code">
            {useRecovery ? "Recovery code" : "Authenticator code"}
          </Label>
          <Input
            id="mfa-disable-code"
            value={value}
            onChange={(e) =>
              setValue(
                useRecovery
                  ? e.target.value.toLowerCase()
                  : e.target.value.replace(/\D/g, "").slice(0, 6)
              )
            }
            placeholder={useRecovery ? "Enter recovery code" : "000000"}
            inputMode={useRecovery ? "text" : "numeric"}
            maxLength={useRecovery ? undefined : 6}
            required
            autoFocus
            className={useRecovery ? "font-mono" : "font-mono tracking-[0.3em]"}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={
              submitting || (useRecovery ? value.length === 0 : value.length !== 6)
            }
          >
            {submitting ? "Disabling..." : "Disable MFA"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => {
              setOpen(false);
              setValue("");
              setError("");
              setUseRecovery(false);
            }}
          >
            Cancel
          </Button>
        </div>

        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            setUseRecovery((prev) => !prev);
            setValue("");
            setError("");
          }}
        >
          {useRecovery
            ? "Use an authenticator code instead"
            : "Use a recovery code instead"}
        </Button>
      </form>
    </div>
  );
}
