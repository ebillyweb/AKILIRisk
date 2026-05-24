import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Clock, User, ArrowRight, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listHouseholdMembers } from "@/lib/data/household-members";
import { getClientHouseholdProfilesEnabled } from "@/lib/household/profiles-policy";

/**
 * Interview Completion Page
 *
 * Confirmation page after successful interview submission.
 * Prompts clients to finish Profiles & Roles when still empty or missing governance roles.
 */

export default async function CompletePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const members = await listHouseholdMembers(session.user.id);
  const householdProfilesEnabled = await getClientHouseholdProfilesEnabled(session.user.id);
  const hasHouseholdMembers = members.length > 0;
  const hasAnyGovernanceRole = members.some((m) => m.governanceRoles.length > 0);
  const needsHouseholdProfiles = householdProfilesEnabled && !hasHouseholdMembers;
  const needsGovernanceRoles =
    householdProfilesEnabled && hasHouseholdMembers && !hasAnyGovernanceRole;

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em]">
            Interview Complete
          </h1>
          <p className="text-lg text-muted-foreground">
            Thank you for completing your intake interview.
          </p>
        </div>

        {(needsHouseholdProfiles || needsGovernanceRoles) && (
          <Alert variant="warning">
            <UsersRound className="size-5 shrink-0" aria-hidden />
            <AlertTitle>Profiles &amp; Roles</AlertTitle>
            <AlertDescription className="space-y-3">
              {needsHouseholdProfiles ? (
                <p>
                  You have not added anyone to{" "}
                  <strong>Profiles &amp; Roles</strong> yet. Adding household members
                  helps tailor your assessment and avoids repeating questions you already
                  cover in your family profile.
                </p>
              ) : (
                <p>
                  Add at least one <strong>governance role</strong> for someone in your
                  household on <strong>Profiles &amp; Roles</strong> when you can. Roles
                  help the assessment match how your family actually makes decisions.
                </p>
              )}
              <Button asChild size="sm" className="mt-1 w-full sm:w-auto">
                <Link href="/profiles" className="inline-flex items-center justify-center gap-2">
                  Go to Profiles &amp; Roles
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                This step is optional, but recommended. Your advisor can also update your
                household profile later if you prefer.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-6">What Happens Next</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">Advisor Review</h3>
                <p className="text-sm text-muted-foreground">
                  Your advisor will review your audio responses and transcriptions to
                  understand your family&apos;s unique governance context.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">2</span>
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">Focus Area Identification</h3>
                <p className="text-sm text-muted-foreground">
                  They will identify key focus areas for your governance assessment based on
                  your family&apos;s specific needs and challenges.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">3</span>
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">Customized Assessment</h3>
                <p className="text-sm text-muted-foreground">
                  You will receive a customized governance assessment tailored to your
                  family&apos;s circumstances and priorities.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-muted/60 border-border">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-medium text-foreground">Timeline</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Your advisor will typically review your responses within 1-2 business days. You
            will be notified when your customized assessment is ready.
          </p>
        </Card>

        <div className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <Link href="/dashboard" className="flex items-center justify-center gap-2">
              Return to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              In the meantime, you can explore other areas of your workspace.
            </p>
          </div>
        </div>

        <Card className="p-6 border-dashed">
          <h3 className="font-medium mb-3">While You Wait</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Review or add household members under Profiles &amp; Roles</p>
            <p>• Explore the assessment framework to understand the evaluation criteria</p>
            <p>• Consider additional family members who should participate in the process</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
