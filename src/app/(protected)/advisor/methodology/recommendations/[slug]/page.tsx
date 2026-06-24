import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadAdvisorRecommendationRules, loadActiveServiceRecommendations } from "@/lib/methodology/methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationRulesEditor } from "@/components/advisor/methodology/RecommendationRulesEditor";

export default async function MethodologyRecommendationsPage({
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

  const rules = await loadAdvisorRecommendationRules(profileId, slug);
  const services = await loadActiveServiceRecommendations();

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Methodology</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recommendation rules — {pillar.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Edit or deactivate platform base rules, or add custom triggers for your clients.
          Snapshotted at intake start.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rules.length} rule{rules.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules for this pillar.</p>
          ) : (
            <RecommendationRulesEditor
              pillarSlug={slug}
              services={services}
              rules={rules.map((rule) => ({
                id: rule.id,
                sourceKind: rule.sourceKind,
                name: rule.name,
                priority: rule.priority,
                isActive: rule.isActive,
              }))}
            />
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        {pillars.map((p) => (
          <Button
            key={p.id}
            variant={p.slug === slug ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/advisor/methodology/recommendations/${p.slug}`}>
              {p.name}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
