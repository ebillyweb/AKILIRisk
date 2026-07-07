import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { prisma } from "@/lib/db";
import { getEnterpriseOverlays } from "@/lib/actions/enterprise-solution-actions";
import {
  GuidanceCustomization,
  type ServiceRecommendationData,
  type EnterpriseOverlayData,
} from "@/components/enterprise/GuidanceCustomization";

export default async function EnterpriseGuidancePage() {
  let enterpriseName: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseName = team.enterpriseName;
  } catch {
    redirect("/signin");
  }

  // Load all active platform recommendations for the catalog
  const serviceRecommendations = await prisma.serviceRecommendation.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { priority: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      priority: true,
      estimatedCost: true,
      timeframe: true,
      provider: true,
      expectedOutcome: true,
      tags: true,
      shortDescription: true,
      icon: true,
      playbook: true,
      prerequisites: true,
      externalUrl: true,
    },
  });

  // Load existing enterprise overlays
  const overlayResult = await getEnterpriseOverlays();
  const overlays: EnterpriseOverlayData[] =
    overlayResult.success
      ? (overlayResult.data.overlays as unknown as EnterpriseOverlayData[])
      : [];

  const recommendations: ServiceRecommendationData[] = serviceRecommendations.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    priority: r.priority,
    estimatedCost: r.estimatedCost,
    timeframe: r.timeframe,
    provider: r.provider,
    expectedOutcome: r.expectedOutcome,
    tags: r.tags,
    shortDescription: r.shortDescription,
    icon: r.icon,
    playbook: r.playbook,
    prerequisites: r.prerequisites,
    externalUrl: r.externalUrl,
  }));

  return (
    <div className="space-y-6">
      {/* Hero surface */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60"
              aria-hidden
            >
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Enterprise Guidance
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Guidance Customization
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Layer firm-specific guidance, preferred vendors, and compliance requirements onto
                platform recommendations
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{enterpriseName}</span>
        </div>
      </div>

      {/* Two-column overlay editor */}
      <GuidanceCustomization
        recommendations={recommendations}
        overlays={overlays}
      />
    </div>
  );
}
