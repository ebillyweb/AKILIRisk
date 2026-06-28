import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { isImplementationTrackingEnabled } from "@/lib/engagement/feature-flags";
import { EngagementDashboard } from "@/components/engagement/EngagementDashboard";

export default async function EngagementPage() {
  let advisorProfileId: string;

  try {
    const { userId } = await requireAdvisorRole();

    const advisorProfile = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!advisorProfile) {
      redirect("/advisor");
    }

    const enabled = await isImplementationTrackingEnabled(advisorProfile.id);
    if (!enabled) {
      redirect("/advisor/dashboard");
    }

    advisorProfileId = advisorProfile.id;
  } catch {
    redirect("/advisor");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/advisor/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Engagement
          </p>
          <h1 className="text-2xl font-semibold font-display tracking-[-0.03em] text-foreground">
            Implementation Tracking
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Track client progress across published action plans. For scheduled
            review cycles and linked reassessments, see{" "}
            <Link href="/advisor/reassessment" className="underline underline-offset-2">
              Reassessment cadence
            </Link>
            .
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="text-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading engagement data...</p>
          </div>
        }
      >
        <EngagementDashboard advisorProfileId={advisorProfileId} />
      </Suspense>
    </div>
  );
}
