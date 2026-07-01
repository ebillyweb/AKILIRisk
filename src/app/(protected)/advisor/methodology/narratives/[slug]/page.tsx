import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  loadActiveAdvisorMethodologyPillars,
  loadAdvisorPillarNarrative,
  methodologyPillarDisplayName,
} from "@/lib/methodology/methodology-queries";
import { narrativeStarterForSlug } from "@/lib/methodology/narrative-starter";
import { Button } from "@/components/ui/button";
import { NarrativeEditor } from "@/components/advisor/methodology/NarrativeEditor";
import { MethodologyPillarTabs } from "@/components/advisor/methodology/MethodologyPillarTabs";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyNarrativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);

  let profileId: string;
  let activePillars: Awaited<ReturnType<typeof loadActiveAdvisorMethodologyPillars>>;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
    activePillars = await loadActiveAdvisorMethodologyPillars(profileId);
  } catch {
    redirect("/signin");
  }

  const pillar = activePillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  const row = await loadAdvisorPillarNarrative(profileId, slug);
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
        <Link href="/advisor/methodology">Your methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-narratives"
        title={`Pillar narratives — ${methodologyPillarDisplayName(pillar)}`}
        description="Outcome copy for score reports and PDFs. Snapshotted at intake start."
      />
      <div data-tour="config-primary-form">
        <NarrativeEditor
        pillarSlug={slug}
        allNegative={allNegative}
        allYes={allYes}
        midBand={midBand as { critical: string[]; high: string[]; medium: string[]; low: string[] }}
        />
      </div>
      <MethodologyPillarTabs
        pillars={activePillars}
        activeSlug={slug}
        hrefForSlug={(pillarSlug) => `/advisor/methodology/narratives/${pillarSlug}`}
      />
    </div>
  );
}
