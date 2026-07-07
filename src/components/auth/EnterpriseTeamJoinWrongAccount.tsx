import Link from "next/link";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type EnterpriseTeamJoinWrongAccountProps = {
  inviteeEmail: string;
  signedInEmail: string;
  joinPath: string;
};

export function EnterpriseTeamJoinWrongAccount({
  inviteeEmail,
  signedInEmail,
  joinPath,
}: EnterpriseTeamJoinWrongAccountProps) {
  const signOutHref = `/api/auth/signout?callbackUrl=${encodeURIComponent(joinPath)}`;

  return (
    <AuthPanel
      eyebrow="Team invitation"
      title="Wrong account"
      description="This invitation was sent to a different email address."
    >
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            You are signed in as <strong>{signedInEmail}</strong>, but this invitation was sent to{" "}
            <strong>{inviteeEmail}</strong>.
          </AlertDescription>
        </Alert>

        <Button asChild size="lg" className="w-full">
          <Link href={signOutHref}>Sign in with {inviteeEmail}</Link>
        </Button>
      </div>
    </AuthPanel>
  );
}
