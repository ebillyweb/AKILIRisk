"use client";

import { useState, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePasswordComplexity,
} from "@/lib/auth/password-policy";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate URL parameters
  if (!token || !email) {
    return (
      <AuthPanel
        eyebrow="Password Recovery"
        title="Invalid reset link"
        description="This password reset link is invalid or incomplete. Request a new reset email to continue."
        footer={
          <Link href="/forgot-password" className="font-semibold text-foreground hover:underline">
            Request new reset link
          </Link>
        }
      >
        <Alert variant="destructive">
          <AlertDescription>
            For your security, password reset links can only be used with the
            original email and a valid token.
          </AlertDescription>
        </Alert>
      </AuthPanel>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    const complexity = validatePasswordComplexity(password);
    if (!complexity.ok) {
      setError(complexity.error);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthPanel
        eyebrow="Password Recovery"
        title="Password updated"
        description="Your password has been updated. You can now return to the workspace and sign in with your new credentials."
      >
        <Button asChild size="lg" className="w-full">
          <Link href="/signin">Return to Sign In</Link>
        </Button>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      eyebrow="Password Recovery"
      title="Reset password"
      description="Choose a new password for your account. Use a strong, unique passphrase for best protection."
      footer={
        <Link href="/signin" className="font-semibold text-foreground hover:underline">
          Return to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Enter a new password"
          />
          <p className="text-sm text-muted-foreground">
            {PASSWORD_REQUIREMENTS_MESSAGE}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Repeat your new password"
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Resetting..." : "Reset Password"}
        </Button>
      </form>
    </AuthPanel>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading reset flow...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
