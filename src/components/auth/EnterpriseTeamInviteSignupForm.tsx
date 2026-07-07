"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { registerEnterpriseTeamInviteeAction } from "@/lib/actions/enterprise-team-actions";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "@/lib/auth/password-policy";
import { broadcastAuthSessionChange } from "@/lib/auth/session-sync";

type EnterpriseTeamInviteSignupFormProps = {
  token: string;
  joinPath: string;
  enterpriseName: string;
  inviteeEmail: string;
};

type FieldErrors = Record<string, string[]>;

export function EnterpriseTeamInviteSignupForm({
  token,
  joinPath,
  enterpriseName,
  inviteeEmail,
}: EnterpriseTeamInviteSignupFormProps) {
  const router = useRouter();
  const signInHref = buildSignInHref({
    role: "advisor",
    callbackUrl: joinPath,
    email: inviteeEmail,
  });

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  function fieldError(id: string): string | undefined {
    return fieldErrors[id]?.[0];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const result = await registerEnterpriseTeamInviteeAction({
        token,
        name,
        password,
        confirmPassword,
        acceptTerms,
      });

      if (!result.success) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        setIsLoading(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: inviteeEmail,
        password,
        redirect: false,
      });

      if (signInResult?.error || signInResult?.ok === false) {
        setError("Account created, but sign-in failed. Use the sign-in link below.");
        setIsLoading(false);
        return;
      }

      broadcastAuthSessionChange();
      router.push(joinPath);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <AuthPanel
      eyebrow="Team invitation"
      title={`Join ${enterpriseName}`}
      description="Create your team member account to accept this invitation."
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
        <div className="space-y-2">
          <Label htmlFor="enterprise-invite-name">Your name</Label>
          <Input
            id="enterprise-invite-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="name"
            placeholder="Jordan Lee"
          />
          {fieldError("name") ? (
            <p className="text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="enterprise-invite-firm">Firm</Label>
          <Input
            id="enterprise-invite-firm"
            value={enterpriseName}
            readOnly
            disabled
            className="bg-muted/40"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="enterprise-invite-email">Work email</Label>
          <Input
            id="enterprise-invite-email"
            type="email"
            value={inviteeEmail}
            readOnly
            disabled
            className="bg-muted/40"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="enterprise-invite-password">Password</Label>
          <PasswordInput
            id="enterprise-invite-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
          {fieldError("password") ? (
            <p className="text-xs text-destructive">{fieldError("password")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="enterprise-invite-confirm-password">Confirm password</Label>
          <PasswordInput
            id="enterprise-invite-confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
          {fieldError("confirmPassword") ? (
            <p className="text-xs text-destructive">{fieldError("confirmPassword")}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="enterprise-invite-accept-terms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
            required
          />
          <label
            htmlFor="enterprise-invite-accept-terms"
            className="text-sm font-normal leading-normal"
          >
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-foreground hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-foreground hover:underline">
              Privacy Policy
            </Link>.
          </label>
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
          {isLoading ? "Creating account…" : "Create account and continue"}
        </Button>
      </form>
    </AuthPanel>
  );
}
