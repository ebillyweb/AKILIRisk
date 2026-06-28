import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadEnterprisePillarNarrative } from "@/lib/methodology/enterprise-methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { narrativeStarterForSlug } from "@/lib/methodology/narrative-starter";
import { Button } from "@/components/ui/button";
import { EnterpriseNarrativeEditor } from "@/components/advisor/enterprise/EnterpriseNarrativeEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseMethodologyNarrativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);
  const pillars = await loadPlatformPillars();
  const pillar = pillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

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
        <Link href="/advisor/enterprise/methodology">Firm methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-narratives"
        title={`${enterpriseName} — Pillar narratives (${pillar.name})`}
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
      <div className="flex flex-wrap gap-2">
        {pillars.map((p) => (
          <Button
            key={p.id}
            variant={p.slug === slug ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/advisor/enterprise/methodology/narratives/${p.slug}`}>
              {p.name}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
