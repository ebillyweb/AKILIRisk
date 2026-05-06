"use client";

import { useState, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const accountDeactivatedNotice = searchParams.get("notice") === "account_deactivated";
  const isAdvisorPortal = searchParams.get("portal") === "advisor";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error || result?.ok === false) {
        setError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      const redirectTo = safeAfterSignInPath(callbackUrl);
      // Full navigation so the next document request includes the session cookie.
      // router.push + refresh can run before the browser applies Set-Cookie from
      // the credentials callback, so auth() on the server sees no session.
      window.location.assign(redirectTo);
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <AuthPanel
      eyebrow={isAdvisorPortal ? "Advisor Portal" : "Client Access"}
      title="Sign in"
      description="Continue your assessment workspace with a streamlined, security-conscious sign-in flow."
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Don&apos;t have an account?{" "}
            <Link
              href={
                callbackUrl
                  ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : "/signup"
              }
              className="font-semibold text-foreground hover:underline"
            >
              Sign up
            </Link>
          </span>
          <Link
            href={
              callbackUrl
                ? `/forgot-password?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : "/forgot-password"
            }
            className="font-semibold text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      }
    >
      {accountDeactivatedNotice ? (
        <Alert className="mb-5" variant="info">
          <AlertDescription>
            This account has been deactivated. Contact your administrator if you need access
            restored.
          </AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="name@familyoffice.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>

        {/* Round-11 commit 3 (BRD §5.1.AUTH): client sign-in is via
            magic link, not email + password. Surface the path here for
            anyone who landed on the credentials form by accident. */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          Client account?{" "}
          <Link href="/signin/magic-link" className="text-primary hover:underline">
            Sign in with an email link
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading sign-in experience...
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
