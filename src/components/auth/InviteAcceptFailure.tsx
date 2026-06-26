import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function InviteAcceptFailure({ message }: { message: string }) {
  return (
    <AuthPanel
      title="Invitation link"
      description="We couldn't sign you in with this link."
    >
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
          Ask your advisor to resend the invitation, or{" "}
          <Link href="/signin/magic-link" className="text-primary hover:underline">
            request a sign-in link
          </Link>{" "}
          if you already have an account.
        </p>
      </div>
    </AuthPanel>
  );
}

export function ClientSignupInfoPanel() {
  return (
    <AuthPanel
      title="Sign up"
      description="Akili Risk client accounts are created by your advisor."
    >
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            We don&apos;t use passwords for client accounts. Your advisor will
            send you a sign-in link by email when your account is ready. Click
            the link in that email to sign in.
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
            <Link href="/signup/advisor" className="text-primary hover:underline">
              Create an account
            </Link>
            {" · "}
            <Link href="/signin?portal=advisor" className="text-primary hover:underline">
              Sign in
            </Link>
            .
          </p>
        </div>
      </div>
    </AuthPanel>
  );
}
