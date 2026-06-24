import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { loadAdvisorAssessmentQuestions } from "@/lib/methodology/methodology-queries";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentQuestionsEditor } from "@/components/advisor/methodology/AssessmentQuestionsEditor";

export default async function MethodologyQuestionsPage({
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

  const questions = await loadAdvisorAssessmentQuestions(profileId, slug);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Methodology</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Assessment questions — {pillar.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Edit or hide platform base questions, or add custom questions for your clients. Changes
          apply to new intakes only.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions for this pillar yet.</p>
          ) : (
            <AssessmentQuestionsEditor
              pillarSlug={slug}
              questions={questions.map((q) => ({
                id: q.id,
                sourceKind: q.sourceKind,
                questionNumber: q.questionNumber,
                questionText: q.questionText,
                whyThisMatters: q.whyThisMatters,
                recommendedActions: q.recommendedActions,
                isVisible: q.isVisible,
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
            <Link href={`/advisor/methodology/questions/${p.slug}`}>{p.name}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
