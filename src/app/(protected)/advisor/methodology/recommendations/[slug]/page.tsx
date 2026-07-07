import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { listQuestionsForRulePicker } from "@/lib/admin/recommendation-queries";
import { serviceIdFromRulePayload } from "@/lib/admin/recommendation-rule-ui";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  loadActiveAdvisorMethodologyPillars,
  loadAdvisorRecommendationRules,
  loadActiveServiceRecommendations,
  methodologyPillarDisplayName,
} from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RecommendationRulesEditor } from "@/components/advisor/methodology/RecommendationRulesEditor";
import { MethodologyPillarTabs } from "@/components/advisor/methodology/MethodologyPillarTabs";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyRecommendationsPage({
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

  const [rules, services, questionOptions] = await Promise.all([
    loadAdvisorRecommendationRules(profileId, slug),
    loadActiveServiceRecommendations(),
    listQuestionsForRulePicker(),
  ]);
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Your methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-recommendation-rules"
        title={`Recommendation rules — ${methodologyPillarDisplayName(pillar)}`}
        description="Edit or deactivate platform base rules, or add custom triggers for your clients. Snapshotted at intake start."
      />
      <Card>
        <CardContent className="pt-6">
          <RecommendationRulesEditor
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
        hrefForSlug={(pillarSlug) =>
          `/advisor/methodology/recommendations/${pillarSlug}`
        }
      />
    </div>
  );
}
