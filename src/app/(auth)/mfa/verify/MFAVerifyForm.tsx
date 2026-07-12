"use client";

import { useState } from "react";
import { getSession, signOut } from "next-auth/react";
import { resolvePostSignInPath } from "@/lib/auth-callback-path";
import { scopePostAuthPath } from "@/lib/client/tenant-path-prefix-client";
import { broadcastAuthSessionChange } from "@/lib/auth/session-sync";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MFAVerifyFormProps {
  callbackUrl: string;
}

export function MFAVerifyForm({ callbackUrl }: MFAVerifyFormProps) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [token, setToken] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleTOTPSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "login",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      broadcastAuthSessionChange();
      const session = await getSession();
      window.location.assign(
        scopePostAuthPath(
          resolvePostSignInPath(callbackUrl, session?.user?.role),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/mfa/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: recoveryCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Recovery code verification failed");
      }

      if (data.remainingCodes <= 2) {
        alert(
          `Warning: You have ${data.remainingCodes} recovery code${
            data.remainingCodes === 1 ? "" : "s"
          } remaining. Consider generating new codes in settings.`
        );
      }

      broadcastAuthSessionChange();
      const session = await getSession();
      window.location.assign(
        scopePostAuthPath(
          resolvePostSignInPath(callbackUrl, session?.user?.role),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthPanel
      eyebrow="Multi-Factor Authentication"
      title="Verify your identity"
      description={
        useRecovery
          ? "Use one of your saved recovery codes to continue securely."
          : "Enter the current code from your authenticator app to access the workspace."
      }
      footer={
        <Button
          type="button"
          variant="ghost"
          className="h-auto p-0"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await signOut({ callbackUrl: "/" });
          }}
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      }
    >
      {!useRecovery ? (
        <form onSubmit={handleTOTPSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="token">Authentication code</Label>
            <Input
              type="text"
              id="token"
              value={token}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              required
              autoFocus
              className="text-center font-mono text-2xl tracking-[0.45em]"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={verifying || token.length !== 6}>
            {verifying ? "Verifying..." : "Verify"}
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={() => setUseRecovery(true)}>
            Use a recovery code instead
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRecoverySubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="recovery">Recovery code</Label>
            <Input
              type="text"
              id="recovery"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toLowerCase())}
              placeholder="Enter recovery code"
              required
              autoFocus
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">
              Recovery codes are single-use and will be consumed after successful verification.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={verifying || !recoveryCode}>
            {verifying ? "Verifying..." : "Verify Recovery Code"}
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={() => setUseRecovery(false)}>
            Use authenticator app instead
          </Button>
        </form>
      )}
    </AuthPanel>
  );
}
