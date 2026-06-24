import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadAdvisorPillarNarrative } from "@/lib/methodology/methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { narrativeStarterForSlug } from "@/lib/methodology/narrative-starter";
import { Button } from "@/components/ui/button";
import { NarrativeEditor } from "@/components/advisor/methodology/NarrativeEditor";

export default async function MethodologyNarrativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);
  const pillars = await loadPlatformPillars();
  const pillar = pillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  let profileId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
  } catch {
    redirect("/signin");
  }

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
        <Link href="/advisor/methodology">Methodology</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pillar narratives — {pillar.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Outcome copy for score reports and PDFs. Snapshotted at intake start.
        </p>
      </div>
      <NarrativeEditor
        pillarSlug={slug}
        allNegative={allNegative}
        allYes={allYes}
        midBand={midBand as { critical: string[]; high: string[]; medium: string[]; low: string[] }}
      />
      <div className="flex flex-wrap gap-2">
        {pillars.map((p) => (
          <Button
            key={p.id}
            variant={p.slug === slug ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/advisor/methodology/narratives/${p.slug}`}>
              {p.name}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
