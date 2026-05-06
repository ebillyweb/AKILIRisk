"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Round-11 commit 3 (BRD §5.1.AUTH): client sign-in via magic link.
 *
 * Posts to /api/auth/magic-link/request which is rate-limited per
 * (ip, email) and audits the attempt. Always shows the same
 * confirmation message regardless of whether the email matches an
 * account — enumeration safety.
 */
export default function MagicLinkRequestPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Too many requests. Try again in a bit.");
        return;
      }
      // 200 + same generic body for known + unknown emails. Show the
      // confirmation regardless so the form doesn't leak existence.
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthPanel
        title="Check your email"
        subtitle="We&apos;ve sent you a sign-in link if your account exists."
      >
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              If an account exists for <strong>{email}</strong>, a sign-in link
              is on its way. The link expires in 15 minutes and can only be
              used once.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive an email? Check your spam folder, then{" "}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="text-primary hover:underline"
            >
              try again
            </button>
            .
          </p>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Sign in"
      subtitle="Enter your email and we&apos;ll send you a sign-in link."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Sending…" : "Send me a sign-in link"}
        </Button>
        <p className="text-xs text-muted-foreground pt-2">
          Are you an advisor?{" "}
          <Link href="/signin?portal=advisor" className="text-primary hover:underline">
            Sign in with email + password
          </Link>
          .
        </p>
      </form>
    </AuthPanel>
  );
}
