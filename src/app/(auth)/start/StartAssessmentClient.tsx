"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";

type StartAssessmentClientProps = {
  signInHref: string;
  requestReviewHref: string;
};

/**
 * Public "Start Assessment" entry point. Clients are onboarded by their advisor
 * via an emailed invitation (one click → account created → assessment), so this
 * page routes people to that link or to email sign-in — there is no self-service
 * code entry.
 */
export function StartAssessmentClient({
  signInHref,
  requestReviewHref,
}: StartAssessmentClientProps) {
  return (
    <AuthPanel
      eyebrow="Personal Risk Profile"
      title="Start your risk profile"
      description="Your advisor sets up your risk profile and emails you a secure invitation. Open that link to create your account and begin — no code to enter."
      footer={
        <div className="flex flex-col gap-3">
          <span>
            Don&apos;t have an advisor yet?{" "}
            <Link
              href={requestReviewHref}
              className="font-semibold text-foreground hover:underline"
            >
              Request a review here
            </Link>
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get an invitation? Check your email (including spam), or ask
          your advisor to resend it. If you&apos;ve already started, sign in with
          your email and we&apos;ll send you a secure link.
        </p>
        <Button asChild size="lg" className="w-full">
          <a href={signInHref}>Sign in with your email</a>
        </Button>
      </div>
    </AuthPanel>
  );
}
