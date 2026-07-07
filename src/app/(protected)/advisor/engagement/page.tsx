import { redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { isImplementationTrackingEnabled } from "@/lib/engagement/feature-flags";

/** Legacy Phase 23 route — per-client milestone tracking lives on Recommendations. */
export default async function LegacyEngagementDashboardRedirect() {
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
      redirect("/advisor");
    }
  } catch {
    redirect("/advisor");
  }

  redirect("/advisor/recommendations");
}
