import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { loadEnterpriseMethodologyPillars } from "@/lib/methodology/enterprise-methodology-queries";
import { methodologyPillarDisplayName } from "@/lib/methodology/methodology-queries";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseRecommendationsIndexPage() {
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

  const pillars = await loadEnterpriseMethodologyPillars(enterpriseId);
  const ruleCounts = await prisma.enterpriseRecommendationRule.groupBy({
    by: ["pillarId"],
    where: { enterpriseId },
    _count: true,
  });
  const countByPillarId = new Map(
    ruleCounts.map((r) => [r.pillarId, r._count]),
  );

  return (
    <div className="space-y-6">
      <ConfigurationPageHeader
        tourId="enterprise-recommendation-rules-index"
        title={`${enterpriseName} — Firm recommendation rules`}
        description="Manage recommendation rule defaults for all firm advisors. Changes are automatically synced to member advisors. Individual advisors can further customize their copies."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="config-primary-list">
        {pillars.map((pillar) => {
          const count = countByPillarId.get(pillar.pillarId) ?? 0;
          return (
            <Card key={pillar.pillarId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {methodologyPillarDisplayName(pillar)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {count} rule{count === 1 ? "" : "s"}
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/advisor/enterprise/recommendations/${pillar.slug}`}>
                    Manage
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
