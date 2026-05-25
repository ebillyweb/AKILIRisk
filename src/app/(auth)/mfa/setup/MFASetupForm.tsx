"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MFASetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showingCodes, setShowingCodes] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function enroll() {
      try {
        const res = await fetch("/api/auth/mfa/enroll", {
          method: "POST",
        });

        const data = (await res.json()) as {
          error?: string;
          qrCodeUrl?: string;
          secret?: string;
        };

        if (res.status === 409) {
          router.replace("/settings");
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || "Failed to enroll in MFA");
        }

        setQrCodeUrl(data.qrCodeUrl ?? "");
        setSecret(data.secret ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to enroll");
      } finally {
        setLoading(false);
      }
    }

    void enroll();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "enable",
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        recoveryCodes?: string[];
      };

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify TOTP");
      }

      setRecoveryCodes(data.recoveryCodes ?? []);
      setShowingCodes(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function handleConfirm() {
    router.push("/settings");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Setting up multi-factor authentication...
      </div>
    );
  }

  if (showingCodes) {
    return (
      <AuthPanel
        eyebrow="Security Setup"
        title="Save your recovery codes"
        description="Store these single-use recovery codes in a secure location. They allow you to regain access if your authenticator is unavailable."
      >
        <div className="space-y-5">
          <Alert variant="warning">
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Each recovery code can only be used once. Keep them somewhere secure
              before continuing.
            </AlertDescription>
          </Alert>

          <div className="rounded-[1.5rem] border section-divider bg-background/70 p-5 font-mono text-sm leading-7">
            {recoveryCodes.map((code, i) => (
              <div key={i}>{code}</div>
            ))}
          </div>

          {copied ? (
            <Alert variant="success">
              <AlertDescription>Recovery codes copied to your clipboard.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryCodes.join("\n"));
                setCopied(true);
              }}
            >
              Copy to Clipboard
            </Button>
            <Button type="button" className="flex-1" onClick={handleConfirm}>
              I&apos;ve Saved My Codes
            </Button>
          </div>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      eyebrow="Security Setup"
      title="Set up two-factor authentication"
      description="Scan the QR code with your authenticator app, then enter the six-digit code to enable MFA for your account."
      footer={
        <Link href="/settings" className="font-semibold text-foreground hover:underline">
          Cancel and return to settings
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[1.5rem] border section-divider bg-background/60 p-5">
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            Supported apps include Google Authenticator, Authy, 1Password, and
            other time-based code generators.
          </p>

          {qrCodeUrl ? (
            <div className="flex justify-center">
              <Image
                src={qrCodeUrl}
                alt="MFA QR Code"
                width={220}
                height={220}
                className="rounded-2xl border section-divider bg-white p-3"
              />
            </div>
          ) : null}

          <details className="mt-5 rounded-2xl border section-divider bg-card/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Can&apos;t scan? Enter manually
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Secret Key
              </p>
              <code className="block break-all text-sm">{secret}</code>
            </div>
          </details>
        </div>

        <form onSubmit={handleVerify} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="token">Authenticator code</Label>
            <Input
              type="text"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
              className="text-center font-mono text-2xl tracking-[0.45em]"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={verifying || token.length !== 6}>
            {verifying ? "Verifying..." : "Verify and Enable MFA"}
          </Button>
        </form>
      </div>
    </AuthPanel>
  );
}
