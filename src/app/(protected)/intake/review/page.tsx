import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClientIntakeReviewView } from "@/components/intake/ClientIntakeReviewView";
import { auth } from "@/lib/auth";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { hasClientAssessmentStarted } from "@/lib/client/intake-edit-gate";
import { getClientIntakeReviewPageData } from "@/lib/client/intake-review";

export default async function IntakeReviewPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/intake/review" }));
  }

  const locked = await hasClientAssessmentStarted(session.user.id);
  if (!locked) {
    redirect("/intake");
  }

  const data = await getClientIntakeReviewPageData(session.user.id);
  if (!data) {
    redirect("/intake");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8 sm:py-12">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/dashboard" className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" aria-hidden />
            Back to dashboard
          </Link>
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">
            Family Governance Intake
          </h1>
          <p className="text-muted-foreground">
            Your submitted answers are read-only now that your personal risk
            profile assessment has started.
          </p>
        </div>
      </div>

      <Alert>
        <Lock className="size-5 shrink-0" aria-hidden />
        <AlertTitle>Read-only</AlertTitle>
        <AlertDescription>
          Contact your advisor if you need to update anything in your intake
          interview.
        </AlertDescription>
      </Alert>

      <ClientIntakeReviewView
        questions={data.questions}
        responses={data.responses}
      />
    </div>
  );
}
