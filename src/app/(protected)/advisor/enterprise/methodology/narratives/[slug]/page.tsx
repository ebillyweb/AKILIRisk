import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  loadActiveEnterpriseMethodologyPillars,
  loadEnterprisePillarNarrative,
} from "@/lib/methodology/enterprise-methodology-queries";
import { methodologyPillarDisplayName } from "@/lib/methodology/methodology-queries";
import { narrativeStarterForSlug } from "@/lib/methodology/narrative-starter";
import { Button } from "@/components/ui/button";
import { EnterpriseNarrativeEditor } from "@/components/advisor/enterprise/EnterpriseNarrativeEditor";
import { MethodologyPillarTabs } from "@/components/advisor/methodology/MethodologyPillarTabs";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseMethodologyNarrativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);

  let enterpriseId: string;
  let enterpriseName: string;
  let activePillars: Awaited<ReturnType<typeof loadActiveEnterpriseMethodologyPillars>>;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseId = team.enterpriseId;
    enterpriseName = team.enterpriseName;
    activePillars = await loadActiveEnterpriseMethodologyPillars(enterpriseId);
  } catch {
    redirect("/signin");
  }

  const pillar = activePillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  const row = await loadEnterprisePillarNarrative(enterpriseId, slug);
  const starter = narrativeStarterForSlug(slug);
  const allNegative = (row?.allNegative as string[] | undefined) ?? starter.allNegative;
  const allYes = (row?.allYes as string[] | undefined) ?? starter.allYes;
  const midBand =
    (row?.midBand as {
      critical: string[];
      high: string[];
      medium: string[];
      low: string[];
    } | undefined) ?? starter.midBand;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/methodology">Practice Standards</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-narratives"
        title={`${enterpriseName} — Risk domain narratives (${methodologyPillarDisplayName(pillar)})`}
        description="Firm-wide narrative copy syncs to all member advisors."
      />
      <EnterpriseNarrativeEditor
        pillarSlug={slug}
        allNegative={allNegative}
        allYes={allYes}
        midBand={{
          critical: [...midBand.critical],
          high: [...midBand.high],
          medium: [...midBand.medium],
          low: [...midBand.low],
        }}
      />
      <MethodologyPillarTabs
        pillars={activePillars}
        activeSlug={slug}
        hrefForSlug={(pillarSlug) =>
          `/advisor/enterprise/methodology/narratives/${pillarSlug}`
        }
      />
    </div>
  );
}
