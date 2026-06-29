import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadEnterpriseAssessmentQuestions } from "@/lib/methodology/enterprise-methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EnterpriseAssessmentQuestionsEditor } from "@/components/advisor/enterprise/EnterpriseAssessmentQuestionsEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseMethodologyQuestionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePillarSlug(rawSlug);
  const pillars = await loadPlatformPillars();
  const pillar = pillars.find((p) => p.slug === slug);
  if (!pillar) notFound();

  let enterpriseId: string;
  let enterpriseName: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseId = team.enterpriseId;
    enterpriseName = team.enterpriseName;
  } catch {
    redirect("/signin");
  }

  const questions = await loadEnterpriseAssessmentQuestions(enterpriseId, slug);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/methodology">Firm methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-questions"
        title={`${enterpriseName} — Assessment questions (${pillar.name})`}
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
      <div className="flex flex-wrap gap-2">
        {pillars.map((p) => (
          <Button
            key={p.id}
            variant={p.slug === slug ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/advisor/enterprise/methodology/questions/${p.slug}`}>{p.name}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
