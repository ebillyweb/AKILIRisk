import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { redirect } from "next/navigation";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { getFamilyDashboardData } from "@/lib/family/queries";
import { HouseholdMemberList } from "@/components/family/HouseholdMemberList";
import { FamilyScoreDisplay } from "@/components/family/FamilyScoreDisplay";
import { ScoreTrendChart } from "@/components/family/ScoreTrendChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function FamilyDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/family/dashboard" }));
  }

  // Check role: if ADVISOR or ADMIN, redirect to /advisor
  const role = session.user.role?.toString().toUpperCase();
  if (isAdvisorHubNavRole(role)) {
    redirect("/advisor");
  }

  // Get family dashboard data
  const dashboardData = await getFamilyDashboardData(session.user.id);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero section */}
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-2 sm:space-y-3">
            <p className="editorial-kicker">Family Dashboard</p>
            <h2 className="text-3xl font-semibold text-balance sm:text-5xl">
              Family Governance Progress
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              Track your family&apos;s governance maturity, view historical progress,
              and understand where your advisor has focused attention to strengthen your family&apos;s foundation.
            </p>
          </div>

          <HouseholdMemberList members={dashboardData.householdMembers} />
        </div>
      </section>

      {/* Main content area */}
      {dashboardData.currentScore !== null ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Current Score Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Current Governance Score</CardTitle>
              <CardDescription>
                Your latest assessment results with pillar breakdown and advisor emphasis areas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FamilyScoreDisplay
                currentScore={dashboardData.currentScore}
                pillarScores={dashboardData.currentPillarScores}
                advisorEmphasis={dashboardData.advisorEmphasis}
              />
            </CardContent>
          </Card>

          {/* Historical Trend Chart */}
          {dashboardData.hasMultipleAssessments && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Your Progress Over Time</CardTitle>
                <CardDescription>
                  Track how your governance score has improved across multiple annual assessments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreTrendChart
                  historicalAssessments={dashboardData.historicalAssessments}
                  advisorEmphasis={dashboardData.advisorEmphasis}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Empty state for no assessments */
        <Card>
          <CardContent className="py-16">
            <div className="text-center space-y-4">
              <div className="rounded-[1.5rem] border section-divider bg-background/55 px-6 py-10">
                <h3 className="text-xl font-semibold mb-3">Ready to Begin?</h3>
                <p className="mx-auto mb-6 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Complete your first governance assessment to see your results here.
                  Your family dashboard will show your governance score, risk areas,
                  and progress over time.
                </p>
                <Button asChild size="lg">
                  <Link href="/assessment">Start Assessment</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}