import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { listQuestionsForRulePicker } from "@/lib/admin/recommendation-queries";
import { serviceIdFromRulePayload } from "@/lib/admin/recommendation-rule-ui";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadEnterpriseRecommendationRules } from "@/lib/methodology/enterprise-recommendation-queries";
import { loadActiveEnterpriseMethodologyPillars } from "@/lib/methodology/enterprise-methodology-queries";
import {
  loadActiveServiceRecommendations,
  methodologyPillarDisplayName,
} from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EnterpriseRecommendationRulesEditor } from "@/components/advisor/enterprise/EnterpriseRecommendationRulesEditor";
import { MethodologyPillarTabs } from "@/components/advisor/methodology/MethodologyPillarTabs";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseRecommendationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);

  let enterpriseName: string;
  let enterpriseId: string;
  let activePillars: Awaited<ReturnType<typeof loadActiveEnterpriseMethodologyPillars>>;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseName = team.enterpriseName;
    enterpriseId = team.enterpriseId;
    activePillars = await loadActiveEnterpriseMethodologyPillars(enterpriseId);
  } catch {
    redirect("/signin");
  }

  const pillar = activePillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  const [rules, services, questionOptions] = await Promise.all([
    loadEnterpriseRecommendationRules(enterpriseId, slug),
    loadActiveServiceRecommendations(),
    listQuestionsForRulePicker(),
  ]);
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/recommendations">Firm recommendations</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="enterprise-recommendation-rules"
        title={`${enterpriseName} — Recommendation rules — ${methodologyPillarDisplayName(pillar)}`}
        description="Firm-wide recommendation defaults. Changes sync to all member advisors. Individual advisors can further customize their own copies."
      />
      <Card>
        <CardContent className="pt-6">
          <EnterpriseRecommendationRulesEditor
            pillarSlug={slug}
            services={services}
            questionOptions={questionOptions}
            rules={rules.map((rule) => {
              const serviceRecommendationId = serviceIdFromRulePayload(rule.servicePayload);
              return {
                id: rule.id,
                sourceKind: rule.sourceKind,
                name: rule.name,
                priority: rule.priority,
                isActive: rule.isActive,
                triggerConditions: rule.triggerConditions,
                serviceRecommendationId,
                serviceName: serviceRecommendationId
                  ? (serviceNameById.get(serviceRecommendationId) ?? null)
                  : null,
              };
            })}
          />
        </CardContent>
      </Card>
      <MethodologyPillarTabs
        pillars={activePillars}
        activeSlug={slug}
        hrefForSlug={(pillarSlug) => `/advisor/enterprise/recommendations/${pillarSlug}`}
      />
    </div>
  );
}
