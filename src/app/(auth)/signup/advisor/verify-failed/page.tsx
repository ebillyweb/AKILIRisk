import Link from "next/link";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const REASON_COPY: Record<string, string> = {
  not_found: "This confirmation link is invalid or has already been used.",
  expired: "This confirmation link has expired.",
  used: "This confirmation link has already been used.",
  sign_in_failed: "We confirmed your email but could not sign you in. Try signing in manually.",
};

export default async function AdvisorVerifyFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    (reason && REASON_COPY[reason]) ||
    "We couldn't verify your email with this link.";

  return (
    <AuthPanel
      eyebrow="Advisor's Workspace"
      title="Email confirmation"
      description="We couldn't complete verification."
    >
      <div className="space-y-5">
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:flex-1">
            <Link href="/signup/advisor">Create account</Link>
          </Button>
          <Button asChild variant="outline" className="sm:flex-1">
            <Link href="/signin?role=advisor">Sign in</Link>
          </Button>
        </div>
      </div>
    </AuthPanel>
  );
}
