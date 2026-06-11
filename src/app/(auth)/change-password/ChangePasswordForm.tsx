"use client";

import { useState, useEffect, FormEvent } from "react";
import { signOut } from "next-auth/react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  buildPasswordRequirementsMessage,
  validatePasswordComplexity,
  type PasswordPolicy,
} from "@/lib/auth/password-policy";

type PolicyResponse = {
  requirements: Pick<
    PasswordPolicy,
    "minLength" | "requireUppercase" | "requireNumber"
  >;
  complianceNotice: string | null;
  passwordChangeRequired: boolean;
};

export function ChangePasswordForm({ required = false }: { required?: boolean }) {
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const res = await fetch("/api/auth/change-password");
        if (!res.ok) {
          throw new Error("Unable to load password policy");
        }
        const data = (await res.json()) as PolicyResponse;
        setPolicy({
          ...data.requirements,
          revision: 0,
          complianceNotice: data.complianceNotice,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load password policy"
        );
      } finally {
        setLoading(false);
      }
    }
    void loadPolicy();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!policy) return;

    const complexity = validatePasswordComplexity(newPassword, policy);
    if (!complexity.ok) {
      setError(complexity.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string; requiresSignIn?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Failed to update password");
        setSubmitting(false);
        return;
      }

      await signOut({ callbackUrl: "/signin?notice=password_updated" });
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading password requirements…
      </div>
    );
  }

  const requirementsMessage = policy
    ? buildPasswordRequirementsMessage(policy)
    : "";

  return (
    <AuthPanel
      eyebrow="Account Security"
      title={required ? "Update your password" : "Change password"}
      description={
        required
          ? "Your password no longer meets the platform security policy. Choose a new password to continue."
          : "Choose a new password that meets the current platform requirements."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {required ? (
          policy?.complianceNotice ? (
            <Alert variant="warning">
              <AlertTitle>Action required</AlertTitle>
              <AlertDescription>{policy.complianceNotice}</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <AlertTitle>Action required</AlertTitle>
              <AlertDescription>
                For your security, update your password to meet the current platform
                requirements before using the workspace.
              </AlertDescription>
            </Alert>
          )
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <PasswordInput
            id="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <PasswordInput
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="text-sm text-muted-foreground">{requirementsMessage}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Updating…" : "Update Password"}
        </Button>
      </form>
    </AuthPanel>
  );
}
