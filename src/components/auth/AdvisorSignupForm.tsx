"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "@/lib/auth/password-policy";
import {
  advisorBillingDeepLink,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";
import type { BillingCycle } from "@prisma/client";

type AdvisorSignupFormProps = {
  checkoutPlan: SelfServeTier | null;
  checkoutCycle: BillingCycle | null;
};

type FieldErrors = Record<string, string[]>;

export function AdvisorSignupForm({
  checkoutPlan,
  checkoutCycle,
}: AdvisorSignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const signInHref = buildSignInHref({
    audience: "staff",
    callbackUrl:
      checkoutPlan && checkoutCycle
        ? advisorBillingDeepLink(checkoutPlan, checkoutCycle)
        : "/advisor/billing",
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/advisor-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          firmName,
          email,
          password,
          confirmPassword,
          acceptTerms,
          checkoutPlan: checkoutPlan ?? undefined,
          checkoutCycle: checkoutCycle ?? undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: FieldErrors;
        email?: string;
        verifyUrlForDev?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Could not create your account. Try again.");
        setFieldErrors(data.fieldErrors ?? {});
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (data.email) params.set("email", data.email);
      if (checkoutPlan) params.set("checkout_plan", checkoutPlan);
      if (checkoutCycle) params.set("checkout_cycle", checkoutCycle);
      if (data.verifyUrlForDev) params.set("dev_verify_url", data.verifyUrlForDev);

      router.push(`/signup/advisor/check-email?${params.toString()}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  function fieldError(id: string): string | undefined {
    return fieldErrors[id]?.[0];
  }

  return (
    <AuthPanel
      eyebrow="Advisor's Workspace"
      title="Create your advisor account"
      description="Register to subscribe to AKILI modular plans. We'll email you a confirmation link before checkout."
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={signInHref} className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {checkoutPlan && checkoutCycle ? (
          <Alert variant="info">
            <AlertDescription>
              Selected plan: <span className="font-semibold">{checkoutPlan}</span> (
              {checkoutCycle === "MONTHLY" ? "monthly" : "annual"} billing). You&apos;ll complete
              checkout after confirming your email.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Jordan Lee"
          />
          {fieldError("name") ? (
            <p className="text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="firmName">Firm name</Label>
          <Input
            id="firmName"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            required
            autoComplete="organization"
            placeholder="Northbridge Wealth"
          />
          {fieldError("firmName") ? (
            <p className="text-xs text-destructive">{fieldError("firmName")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@firm.com"
          />
          {fieldError("email") ? (
            <p className="text-xs text-destructive">{fieldError("email")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
          {fieldError("password") ? (
            <p className="text-xs text-destructive">{fieldError("password")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {fieldError("confirmPassword") ? (
            <p className="text-xs text-destructive">{fieldError("confirmPassword")}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="acceptTerms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
            required
          />
          <Label htmlFor="acceptTerms" className="text-sm leading-6 font-normal">
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-foreground hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-foreground hover:underline">
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
        {fieldError("acceptTerms") ? (
          <p className="text-xs text-destructive">{fieldError("acceptTerms")}</p>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthPanel>
  );
}
