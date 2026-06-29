"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Shield, UserRound } from "lucide-react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isPlatformAdminRole,
  normalizeUserRoleString,
} from "@/lib/auth-roles";
import {
  SIGN_IN_HUB_PATH,
  isEnterpriseTeamJoinCallback,
  resolveSignInRole,
} from "@/lib/auth/sign-in-routes";
import {
  advisorSignInPanelDescription,
  clientSignInPanelDescription,
  coerceSignInRoleForBrandedPortal,
  signInHubDescription,
} from "@/lib/auth/sign-in-copy";
import {
  getVisibleSignInRoles,
  type SignInRole,
} from "@/lib/auth/sign-in-roles";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import { scopePostAuthPath } from "@/lib/client/tenant-path-prefix-client";
import { useBrandingOptional } from "@/components/providers/BrandingProvider";
import { broadcastAuthSessionChange } from "@/lib/auth/session-sync";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<SignInRole, typeof UserRound> = {
  client: UserRound,
  advisor: Briefcase,
  admin: Shield,
};

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

function rolePanelCopy(role: SignInRole, firmName?: string | null) {
  switch (role) {
    case "client":
      return {
        eyebrow: "Client access",
        description: clientSignInPanelDescription(firmName),
      };
    case "advisor":
      return {
        eyebrow: "Advisor workspace",
        description: advisorSignInPanelDescription(firmName),
      };
    case "admin":
      return {
        eyebrow: "AKILI platform team",
        description:
          "For AKILI team members with platform access. Sign in with the credentials issued for your admin account.",
      };
  }
}

function ClientMagicLinkPanel({ callbackUrl }: { callbackUrl: string | null }) {
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
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            If an account exists for <strong>{email}</strong>, a sign-in link is on
            its way. The link expires in 15 minutes and can only be used once.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive an email? Check your spam folder, then{" "}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="font-semibold text-foreground hover:underline"
          >
            try again
          </button>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an advisor yet?{" "}
          <Link href="/request-review" className="font-semibold text-foreground hover:underline">
            Get in contact with an advisor
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="min-h-11"
        />
      </div>
      <Button type="submit" disabled={isLoading} size="lg" className="min-h-11 w-full">
        {isLoading ? "Sending…" : "Send me a sign-in link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New family client?{" "}
        <Link href="/start" className="font-semibold text-foreground hover:underline">
          Start with your invite code
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an advisor yet?{" "}
        <Link href="/request-review" className="font-semibold text-foreground hover:underline">
          Get in contact with an advisor
        </Link>
      </p>
      {callbackUrl ? (
        <p className="sr-only">After sign-in you will return to {callbackUrl}.</p>
      ) : null}
    </form>
  );
}

function StaffCredentialsPanel({
  role,
  callbackUrl,
  accountDeactivatedNotice,
  passwordUpdatedNotice,
  initialEmail,
  enterpriseJoinSignupHref,
}: {
  role: "advisor" | "admin";
  callbackUrl: string | null;
  accountDeactivatedNotice: boolean;
  passwordUpdatedNotice: boolean;
  initialEmail?: string | null;
  enterpriseJoinSignupHref?: string | null;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
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
        setError(
          role === "advisor"
            ? "Invalid email or password, or your email may not be confirmed yet. Check your inbox for the confirmation link, or create an account if you're new."
            : "Invalid email or password. AKILI team platform accounts use this form — client accounts require an email link instead."
        );
        setIsLoading(false);
        return;
      }

      const session = await getSession();
      broadcastAuthSessionChange();
      const redirectTo = resolvePostSignInPath(callbackUrl, session?.user?.role);
      window.location.assign(scopePostAuthPath(redirectTo));
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const forgotPasswordHref = callbackUrl
    ? `/forgot-password?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/forgot-password";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {accountDeactivatedNotice ? (
        <Alert className="mb-1" variant="info">
          <AlertDescription>
            This account has been deactivated. Contact your administrator if you need
            access restored.
          </AlertDescription>
        </Alert>
      ) : null}
      {passwordUpdatedNotice ? (
        <Alert className="mb-1" variant="success">
          <AlertDescription>
            Your password was updated. Sign in with your new password to continue.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder={role === "advisor" ? "you@firm.com" : "you@akili.com"}
          className="min-h-11"
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
          className="min-h-11"
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" className="min-h-11 w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>

      <div className="flex justify-end text-sm">
        <Link href={forgotPasswordHref} className="font-semibold text-foreground hover:underline">
          Forgot password?
        </Link>
      </div>

      {role === "advisor" ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {enterpriseJoinSignupHref ? (
            <p>
              New to Akili?{" "}
              <Link
                href={enterpriseJoinSignupHref}
                className="font-semibold text-foreground hover:underline"
              >
                Create your team member account
              </Link>{" "}
              to accept this invitation.
            </p>
          ) : (
            <p>
              New advisor?{" "}
              <Link href="/signup/advisor" className="font-semibold text-foreground hover:underline">
                Create an account
              </Link>
              {" · "}
              <Link
                href="/signup/advisor/check-email"
                className="font-semibold text-foreground hover:underline"
              >
                Resend confirmation
              </Link>
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Need advisor access instead? Switch to the Advisor tab above.
        </p>
      )}
    </form>
  );
}

function SignInHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brandingContext = useBrandingOptional();
  const isBrandedPortal = Boolean(brandingContext?.branding);
  const firmName = brandingContext?.branding
    ? clientPortalBrandingDisplayTitle(brandingContext.branding)
    : null;
  const visibleRoles = getVisibleSignInRoles({ hidePlatform: isBrandedPortal });

  const callbackUrl = searchParams.get("callbackUrl");
  const prefilledEmail = searchParams.get("email");
  const accountDeactivatedNotice = searchParams.get("notice") === "account_deactivated";
  const passwordUpdatedNotice = searchParams.get("notice") === "password_updated";
  const enterpriseTeamJoin = isEnterpriseTeamJoinCallback(callbackUrl);
  const enterpriseJoinSignupHref =
    enterpriseTeamJoin && callbackUrl ? callbackUrl : null;

  const resolvedRole = resolveSignInRole({
    role: searchParams.get("role"),
    portal: searchParams.get("portal"),
    callbackUrl,
  });
  const initialRole = isBrandedPortal
    ? coerceSignInRoleForBrandedPortal(resolvedRole)
    : resolvedRole;

  const [activeRole, setActiveRole] = useState<SignInRole>(initialRole);

  useEffect(() => {
    setActiveRole(initialRole);
  }, [initialRole]);

  const syncRoleToUrl = useCallback(
    (role: SignInRole) => {
      const url = new URL(SIGN_IN_HUB_PATH, "http://local");
      url.searchParams.set("role", role);
      if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
        url.searchParams.set("callbackUrl", callbackUrl);
      }
      const notice = searchParams.get("notice");
      if (notice) {
        url.searchParams.set("notice", notice);
      }
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    },
    [callbackUrl, router, searchParams]
  );

  useEffect(() => {
    if (!isBrandedPortal || searchParams.get("role") !== "admin") return;
    syncRoleToUrl("advisor");
  }, [isBrandedPortal, searchParams, syncRoleToUrl]);

  const handleRoleChange = (value: string) => {
    const role = isBrandedPortal
      ? coerceSignInRoleForBrandedPortal(value as SignInRole)
      : (value as SignInRole);
    setActiveRole(role);
    syncRoleToUrl(role);
  };

  const panelCopy = rolePanelCopy(activeRole, firmName);

  return (
    <AuthPanel
      eyebrow="Sign in"
      title={enterpriseTeamJoin ? "Sign in to accept invitation" : "Welcome back"}
      description={
        enterpriseTeamJoin
          ? "Use the email address that received your team invitation."
          : signInHubDescription(firmName)
      }
      contentClassName="space-y-6"
    >
      <Tabs value={activeRole} onValueChange={handleRoleChange} className="gap-6">
        <TabsList
          aria-label="Sign-in account type"
          className={cn(
            "grid !h-auto min-h-14 w-full items-stretch gap-1.5 rounded-xl bg-muted/70 p-1.5",
            visibleRoles.length === 2 ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {visibleRoles.map(({ id, label, shortLabel }) => {
            const Icon = ROLE_ICONS[id];
            return (
              <TabsTrigger
                key={id}
                value={id}
                className={cn(
                  "!h-auto min-h-11 w-full flex-col gap-1 rounded-lg px-2 py-2.5 text-xs",
                  "sm:flex-row sm:gap-2 sm:text-sm",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <p className="editorial-kicker">{panelCopy.eyebrow}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{panelCopy.description}</p>
        </div>

        <TabsContent value="client" className="mt-0">
          <ClientMagicLinkPanel callbackUrl={callbackUrl} />
        </TabsContent>

        <TabsContent value="advisor" className="mt-0">
          <StaffCredentialsPanel
            role="advisor"
            callbackUrl={callbackUrl}
            accountDeactivatedNotice={accountDeactivatedNotice}
            passwordUpdatedNotice={passwordUpdatedNotice}
            initialEmail={prefilledEmail}
            enterpriseJoinSignupHref={enterpriseJoinSignupHref}
          />
        </TabsContent>

        {!isBrandedPortal ? (
          <TabsContent value="admin" className="mt-0">
            <StaffCredentialsPanel
              role="admin"
              callbackUrl={callbackUrl}
              accountDeactivatedNotice={accountDeactivatedNotice}
              passwordUpdatedNotice={passwordUpdatedNotice}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      {activeRole !== "client" ? (
        <p className="text-center text-sm text-muted-foreground">
          Client account?{" "}
          <button
            type="button"
            onClick={() => handleRoleChange("client")}
            className="font-semibold text-foreground hover:underline"
          >
            Sign in with an email link
          </button>
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {isBrandedPortal && firmName ? `${firmName} advisor?` : "Advisor or AKILI team member?"}{" "}
          <button
            type="button"
            onClick={() => handleRoleChange("advisor")}
            className="font-semibold text-foreground hover:underline"
          >
            Use email and password
          </button>
        </p>
      )}
    </AuthPanel>
  );
}

export function SignInHub() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading sign-in experience...
        </div>
      }
    >
      <SignInHubContent />
    </Suspense>
  );
}
