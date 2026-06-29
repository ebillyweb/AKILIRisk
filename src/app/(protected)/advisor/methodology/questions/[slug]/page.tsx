import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  loadActiveAdvisorMethodologyPillars,
  loadAdvisorAssessmentQuestions,
  methodologyPillarDisplayName,
} from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssessmentQuestionsEditor } from "@/components/advisor/methodology/AssessmentQuestionsEditor";
import { MethodologyPillarTabs } from "@/components/advisor/methodology/MethodologyPillarTabs";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyQuestionsPage({
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

  const questions = await loadAdvisorAssessmentQuestions(profileId, slug);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-questions"
        title={`Assessment questions — ${methodologyPillarDisplayName(pillar)}`}
        description="Edit or hide platform base questions, or add custom questions for your clients. Changes apply to new intakes only."
      />
      <Card>
        <CardContent className="pt-6" data-tour="config-primary-form">
          <AssessmentQuestionsEditor
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
        hrefForSlug={(pillarSlug) => `/advisor/methodology/questions/${pillarSlug}`}
      />
    </div>
  );
}
