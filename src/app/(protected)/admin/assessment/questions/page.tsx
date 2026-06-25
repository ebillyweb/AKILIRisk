import Link from "next/link";
import { Suspense } from "react";
import { requireAdminRole } from "@/lib/admin/auth";
import { adminAssessmentQuestionsAreaPath } from "@/lib/admin/assessment-questions-paths";
import { loadQuestionBankCountsByRiskArea } from "@/lib/assessment/bank/question-bank-dashboard";
import { QuestionBankRiskAreaFilter } from "@/components/admin/QuestionBankRiskAreaFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { sortPillarCatalog } from "@/lib/methodology/pillar-catalog";
import { ChevronRight } from "lucide-react";

export default async function AdminAssessmentQuestionsIndexPage() {
  await requireAdminRole();

  const [countsByArea, catalog] = await Promise.all([
    loadQuestionBankCountsByRiskArea(),
    getPlatformPillarCatalog(),
  ]);
  const pillars = sortPillarCatalog(catalog);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <QuestionBankRiskAreaFilter activeAreaId={null} pillars={catalog} />
      </Suspense>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((area) => {
          const { total, visible } = countsByArea[area.id] ?? { total: 0, visible: 0 };
          return (
            <Link key={area.id} href={adminAssessmentQuestionsAreaPath(area.id)}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {area.name}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{area.summary}</p>
                  <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                    {visible} visible · {total} total
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
