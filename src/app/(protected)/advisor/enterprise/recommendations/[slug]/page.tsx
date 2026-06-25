import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadEnterpriseRecommendationRules } from "@/lib/methodology/enterprise-recommendation-queries";
import { loadActiveServiceRecommendations } from "@/lib/methodology/methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnterpriseRecommendationRulesEditor } from "@/components/advisor/enterprise/EnterpriseRecommendationRulesEditor";

export default async function EnterpriseRecommendationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);
  const pillars = await loadPlatformPillars();
  const pillar = pillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  let enterpriseName: string;
  let enterpriseId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseName = team.enterpriseName;
    enterpriseId = team.enterpriseId;
  } catch {
    redirect("/signin");
  }

  const rules = await loadEnterpriseRecommendationRules(enterpriseId, slug);
  const services = await loadActiveServiceRecommendations();

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/recommendations">Firm recommendations</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {enterpriseName} — Recommendation rules — {pillar.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Firm-wide recommendation defaults. Changes sync to all member advisors.
          Individual advisors can further customize their own copies.
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
            <EnterpriseRecommendationRulesEditor
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
            <Link href={`/advisor/enterprise/recommendations/${p.slug}`}>
              {p.name}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
