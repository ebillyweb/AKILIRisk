"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { InviteCodeForm } from "@/components/auth/InviteCodeForm";

export default function StartAssessmentPage() {
  return (
    <AuthPanel
      eyebrow="Personal Risk Profile"
      title="Enter invite code"
      description="Your advisor has provided a 6-character invite code (letters and numbers) to start the assessment. Enter it below to create your account and begin."
      footer={
        <div className="flex flex-col">
          <span>
            Already have an account?{" "}
            <a
              href="/signin?role=client"
              className="font-semibold text-foreground hover:underline"
            >
              Sign in
            </a>
          </span>
          <div className="mt-3 border-t section-divider pt-3">
            <span>
              Looking for an advisor?{" "}
              <Link
                href="/request-review"
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
