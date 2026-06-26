import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { listQuestionsForRulePicker } from "@/lib/admin/recommendation-queries";
import { serviceIdFromRulePayload } from "@/lib/admin/recommendation-rule-ui";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  loadAdvisorRecommendationRules,
  loadActiveServiceRecommendations,
} from "@/lib/methodology/methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationRulesEditor } from "@/components/advisor/methodology/RecommendationRulesEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

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

  const [rules, services, questionOptions] = await Promise.all([
    loadAdvisorRecommendationRules(profileId, slug),
    loadActiveServiceRecommendations(),
    listQuestionsForRulePicker(),
  ]);
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-recommendation-rules"
        title={`Recommendation rules — ${pillar.name}`}
        description="Edit or deactivate platform base rules, or add custom triggers for your clients. Snapshotted at intake start."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rules.length} rule{rules.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
