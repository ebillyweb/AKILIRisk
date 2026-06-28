import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { loadEnterpriseMethodologyPillars } from "@/lib/methodology/enterprise-methodology-queries";
import { Button } from "@/components/ui/button";
import { EnterprisePillarManagerForm } from "@/components/advisor/enterprise/EnterprisePillarManagerForm";
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

export default async function EnterpriseMethodologyPillarsPage() {
  let enterpriseId: string;
  let enterpriseName: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseId = team.enterpriseId;
    enterpriseName = team.enterpriseName;
  } catch {
    redirect("/signin");
  }

  const pillars = await loadEnterpriseMethodologyPillars(enterpriseId);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/methodology">Firm methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-pillars"
        title={`${enterpriseName} — Pillar manager`}
        description="Firm-wide pillar settings sync to all member advisors."
      />
      <EnterprisePillarManagerForm
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
  );
}
