"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { parseSignupCheckoutIntent } from "@/lib/billing/tier-catalog";

export function AdvisorCheckEmailPanel() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const devVerifyUrl = searchParams.get("dev_verify_url");
  const checkoutIntent = parseSignupCheckoutIntent({
    checkout_plan: searchParams.get("checkout_plan"),
    checkout_cycle: searchParams.get("checkout_cycle"),
  });

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onResend = useCallback(async () => {
    if (!email) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/advisor-signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          checkoutPlan: checkoutIntent?.tier,
          checkoutCycle: checkoutIntent?.billingCycle,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Could not resend the email. Try again later.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Could not resend the email. Try again later.");
    }
  }, [checkoutIntent?.billingCycle, checkoutIntent?.tier, email]);

  return (
    <AuthPanel
      eyebrow="Advisor's Workspace"
      title="Check your email"
      description="Confirm your address to continue to billing and activate your workspace."
    >
      <div className="space-y-5">
        <Alert variant="success">
          <AlertDescription>
            {email ? (
              <>
                We sent a confirmation link to{" "}
                <span className="font-semibold text-foreground">{email}</span>. Open it to verify
                your account and continue to checkout.
              </>
            ) : (
              <>We sent a confirmation link to your email. Open it to verify your account.</>
            )}
          </AlertDescription>
        </Alert>

        <p className="text-sm leading-6 text-muted-foreground">
          The link expires in 24 hours. After confirming, you&apos;ll be signed in automatically and
          taken to billing to complete your subscription.
        </p>

        {devVerifyUrl ? (
          <Alert>
            <AlertDescription>
              Development mode (no Resend):{" "}
              <Link href={devVerifyUrl} className="font-semibold text-foreground hover:underline">
                open verification link
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        {status === "sent" ? (
          <Alert variant="info">
            <AlertDescription>Confirmation email sent again.</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            disabled={!email || status === "sending"}
            onClick={() => void onResend()}
          >
            {status === "sending" ? "Sending…" : "Resend email"}
          </Button>
          <Button asChild className="sm:flex-1">
            <Link href="/signin?role=advisor">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </AuthPanel>
  );
}
