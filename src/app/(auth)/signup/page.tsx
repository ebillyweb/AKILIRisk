import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Round-11 commit 3 (BRD §5.1.AUTH): client signup via password is
 * removed. Clients are created by advisor invitation; the invitation
 * sends a magic link that creates the User row on first click
 * (commit 4 wires that). This page replaces the previous email/password
 * signup form with a "talk to your advisor" message.
 *
 * Pre-this-commit /signup was the destination for invite-driven signups
 * (route protected by an inviteToken query param). Any cached link
 * pointing here now lands on this informational page instead of a
 * dead form.
 */
export default function ClientSignupRetiredPage() {
  return (
    <AuthPanel
      title="Sign up"
      subtitle="Akili Risk client accounts are created by your advisor."
    >
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            We don&apos;t use passwords for client accounts. Your advisor will
            send you a sign-in link by email when your account is ready.
            Click the link in that email to sign in.
          </AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
          Already have a sign-in link? Just click it from your email — no
          additional setup required.
        </p>

        <p className="text-sm text-muted-foreground">
          Need a new sign-in link?{" "}
          <Link href="/signin/magic-link" className="text-primary hover:underline">
            Request one here
          </Link>
          .
        </p>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Are you an advisor?{" "}
            <Link href="/signin?portal=advisor" className="text-primary hover:underline">
              Sign in here
            </Link>
            .
          </p>
        </div>
      </div>
    </AuthPanel>
  );
}
