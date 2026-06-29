import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";
import {
  loadActiveAdvisorMethodologyPillars,
  methodologyPillarDisplayName,
} from "@/lib/methodology/methodology-queries";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Layers,
  ListChecks,
  Sparkles,
  Eye,
  History,
  Bell,
} from "lucide-react";

const LINKS = [
  {
    href: "/advisor/methodology/pillars",
    title: "Pillar manager",
    description: "Toggle pillars, rename labels, set weights and score thresholds.",
    icon: Layers,
  },
  {
    href: "/advisor/methodology/intake",
    title: "Intake script",
    description: "Edit the ordered audio interview script shown to new intakes.",
    icon: ClipboardList,
  },
  {
    href: "/advisor/methodology/narratives/governance",
    title: "Pillar narratives",
    description: "Customize outcome copy for low, mid, and high maturity bands.",
    icon: FileText,
  },
  {
    href: "/advisor/methodology/recommendations/governance",
    title: "Recommendation rules",
    description: "Configure service triggers per pillar.",
    icon: Sparkles,
  },
  {
    href: "/advisor/methodology/preview",
    title: "Preview as client",
    description: "Dry-run your live methodology without starting an intake.",
    icon: Eye,
  },
  {
    href: "/advisor/methodology/versions",
    title: "Pinned versions",
    description: "Snapshots frozen when clients start intake.",
    icon: History,
  },
  {
    href: "/advisor/methodology/catalog-updates",
    title: "Catalog updates",
    description: "Platform pillar catalog changes since your last sync.",
    icon: Bell,
  },
] as const;

export default async function MethodologyHubPage() {
  let profile: Awaited<ReturnType<typeof getAdvisorProfileOrThrow>>;
  try {
    const { userId } = await requireAdvisorRole();
    profile = await getAdvisorProfileOrThrow(userId);
  } catch {
    redirect("/signin");
  }

  const pillars = await loadActiveAdvisorMethodologyPillars(profile.id);

  return (
    <div className="space-y-8">
      <ConfigurationPageHeader
        tourId="advisor-methodology-hub"
        title="Methodology"
        description="Configure your household risk methodology. Changes apply to new intakes only; in-flight clients keep the configuration snapshotted at intake start."
      />

      <Card data-tour="config-pillar-questions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Assessment questions by pillar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {pillars.map((pillar) => (
            <Button key={pillar.pillarId} variant="outline" size="sm" asChild>
              <Link href={`/advisor/methodology/questions/${pillar.slug}`}>
                {methodologyPillarDisplayName(pillar)}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2" data-tour="config-primary-list">
        {LINKS.map((item) => (
          <Card key={item.href} className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon className="h-4 w-4" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <Button size="sm" asChild>
                <Link href={item.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4" />
            Quick tip
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Platform starter content is cloned on first visit. Edit intake script, narratives,
          and assessment questions here; clients receive a frozen snapshot when they begin intake.
        </CardContent>
      </Card>
    </div>
  );
}
