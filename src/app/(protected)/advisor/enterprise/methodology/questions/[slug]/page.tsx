import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  loadActiveEnterpriseMethodologyPillars,
  loadEnterpriseAssessmentQuestions,
} from "@/lib/methodology/enterprise-methodology-queries";
import { methodologyPillarDisplayName } from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EnterpriseAssessmentQuestionsEditor } from "@/components/advisor/enterprise/EnterpriseAssessmentQuestionsEditor";
import { MethodologyPillarTabs } from "@/components/advisor/methodology/MethodologyPillarTabs";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseMethodologyQuestionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);

  let enterpriseId: string;
  let enterpriseName: string;
  let activePillars: Awaited<ReturnType<typeof loadActiveEnterpriseMethodologyPillars>>;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseId = team.enterpriseId;
    enterpriseName = team.enterpriseName;
    activePillars = await loadActiveEnterpriseMethodologyPillars(enterpriseId);
  } catch {
    redirect("/signin");
  }

  const pillar = activePillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  const questions = await loadEnterpriseAssessmentQuestions(enterpriseId, slug);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/methodology">Firm methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-questions"
        title={`${enterpriseName} — Assessment questions (${methodologyPillarDisplayName(pillar)})`}
        description="Firm-wide assessment questions sync to all member advisors."
      />
      <Card>
        <CardContent className="pt-6" data-tour="config-primary-form">
          <EnterpriseAssessmentQuestionsEditor
            pillarSlug={slug}
            questions={questions.map((q) => ({
              id: q.id,
              sourceKind: q.sourceKind,
              questionNumber: q.questionNumber,
              questionText: q.questionText,
              answerType: q.answerType,
              answer0: q.answer0,
              answer1: q.answer1,
              answer2: q.answer2,
              answer3: q.answer3,
              whyThisMatters: q.whyThisMatters,
              recommendedActions: q.recommendedActions,
              isVisible: q.isVisible,
            }))}
          />
        </CardContent>
      </Card>
      <MethodologyPillarTabs
        pillars={activePillars}
        activeSlug={slug}
        hrefForSlug={(pillarSlug) =>
          `/advisor/enterprise/methodology/questions/${pillarSlug}`
        }
      />
    </div>
  );
}
