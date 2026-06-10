"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  buildSignInHref,
  shouldRedirectCredentialsSignInToMagicLink,
} from "@/lib/auth/sign-in-routes";
import {
  isPlatformAdminRole,
  normalizeUserRoleString,
} from "@/lib/auth-roles";
import { broadcastAuthSessionChange } from "@/lib/auth/session-sync";

function resolvePostSignInPath(
  callbackUrl: string | null,
  role: string | undefined
): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  if (isPlatformAdminRole(role)) return "/admin";
  if (normalizeUserRoleString(role) === "ADVISOR") return "/advisor";
  return "/dashboard";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const accountDeactivatedNotice = searchParams.get("notice") === "account_deactivated";
  const isAdvisorPortal = searchParams.get("portal") === "advisor";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!shouldRedirectCredentialsSignInToMagicLink(callbackUrl)) return;
    router.replace(
      buildSignInHref({ callbackUrl, audience: "client" })
    );
  }, [callbackUrl, router]);

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
        setError(
          "Invalid email or password. Platform administrators and advisors must sign in here with a password — client accounts use an email link instead."
        );
        setIsLoading(false);
        return;
      }

      const session = await getSession();
      broadcastAuthSessionChange();
      const redirectTo = resolvePostSignInPath(
        callbackUrl,
        session?.user?.role
      );
      window.location.assign(redirectTo);
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const magicLinkHref = buildSignInHref({
    callbackUrl,
    audience: "client",
  });

  return (
    <AuthPanel
      eyebrow={isAdvisorPortal ? "Advisor Workspace" : "Advisor & Admin"}
      title="Sign in"
      description="Email and password sign-in is for advisors and platform administrators. Client accounts use a one-time email link."
      footer={
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
            placeholder={isAdvisorPortal ? "you@firm.com" : "admin@firm.com"}
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

        <p className="text-center text-sm text-muted-foreground pt-2">
          Client account?{" "}
          <Link href={magicLinkHref} className="font-semibold text-foreground hover:underline">
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
