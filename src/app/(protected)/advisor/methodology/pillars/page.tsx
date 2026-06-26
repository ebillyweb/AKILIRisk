import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { loadAdvisorMethodologyPillars } from "@/lib/methodology/methodology-queries";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { Button } from "@/components/ui/button";
import { PillarManagerForm } from "@/components/advisor/methodology/PillarManagerForm";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

function coerceThreshold(
  raw: unknown,
): { lowMin: number; mediumMin: number; highMin: number } | null {
  if (
    raw &&
    typeof raw === "object" &&
    "lowMin" in raw &&
    "mediumMin" in raw &&
    "highMin" in raw
  ) {
    const t = raw as { lowMin: unknown; mediumMin: unknown; highMin: unknown };
    if (
      typeof t.lowMin === "number" &&
      typeof t.mediumMin === "number" &&
      typeof t.highMin === "number"
    ) {
      return { lowMin: t.lowMin, mediumMin: t.mediumMin, highMin: t.highMin };
    }
  }
  return null;
}

export default async function MethodologyPillarsPage() {
  let profileId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
  } catch {
    redirect("/signin");
  }

  const pillars = await loadAdvisorMethodologyPillars(profileId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/advisor/methodology">Methodology</Link>
        </Button>
      </div>
      <ConfigurationPageHeader
        tourId="advisor-methodology-pillars"
        title="Pillar manager"
        description="Changes apply to new intakes only. Clients in progress keep their snapshotted config."
      />
      <div data-tour="config-primary-form">
        <PillarManagerForm
        pillars={pillars.map((pillar) => ({
          pillarId: pillar.pillarId,
          slug: pillar.slug,
          canonicalName: pillar.canonicalName,
          isActive: pillar.isActive,
          displayName: pillar.displayName,
          weight: pillar.weight,
          displayOrder: pillar.displayOrder,
          threshold: coerceThreshold(pillar.threshold) ?? DEFAULT_RISK_THRESHOLDS,
        }))}
        />
      </div>
    </div>
  );
}
