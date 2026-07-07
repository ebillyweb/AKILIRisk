"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { InviteCodeForm } from "@/components/auth/InviteCodeForm";

type StartAssessmentClientProps = {
  signInHref: string;
  requestReviewHref: string;
  /** When true, copy clarifies that email invitation links bypass this form. */
  invitedViaEmailHint?: boolean;
};

export function StartAssessmentClient({
  signInHref,
  requestReviewHref,
  invitedViaEmailHint = false,
}: StartAssessmentClientProps) {
  return (
    <AuthPanel
      eyebrow="Personal Risk Profile"
      title="Enter invite code"
      description={
        invitedViaEmailHint
          ? "Your advisor may have sent a 6-character code separately. If you received an email invitation, open that link instead — you do not need to enter a code here."
          : "Your advisor has provided a 6-character invite code (letters and numbers) to start the assessment. Enter it below to create your account and begin."
      }
      footer={
        <div className="flex flex-col">
          <span>
            Already have an account?{" "}
            <a href={signInHref} className="font-semibold text-foreground hover:underline">
              Sign in
            </a>
          </span>
          <div className="mt-3 border-t section-divider pt-3">
            <span>
              Looking for an advisor?{" "}
              <Link
                href={requestReviewHref}
                className="font-semibold text-foreground hover:underline"
              >
                Request a review here
              </Link>
            </span>
          </div>
        </div>
      }
    >
      <InviteCodeForm />
    </AuthPanel>
  );
}
