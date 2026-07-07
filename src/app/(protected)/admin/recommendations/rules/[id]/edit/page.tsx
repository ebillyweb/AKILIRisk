import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  getRecommendationRule,
  listQuestionsForRulePicker,
  listServiceRecommendationsForRulePicker,
} from "@/lib/admin/recommendation-queries";
import { RecommendationRuleForm } from "@/components/admin/RecommendationRuleForm";

export default async function EditRecommendationRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole();
  const { id } = await params;
  const [row, serviceOptions, questionOptions] = await Promise.all([
    getRecommendationRule(id),
    listServiceRecommendationsForRulePicker(),
    listQuestionsForRulePicker(),
  ]);
  if (!row) notFound();

  const existing = {
    id: row.id as string,
    serviceRecommendationId: row.serviceRecommendationId as string,
    ruleName: row.ruleName as string,
    description: row.description as string | null,
    triggerConditions: row.triggerConditions as unknown,
    pillarThresholds: row.pillarThresholds as unknown,
    questionConditions: row.questionConditions as unknown,
    priority: row.priority as number,
    isActive: row.isActive as boolean,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/recommendations?view=rules" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to rules
        </Link>
        <Link
          href={`/admin/audit-log/entity/RecommendationRule/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View change history
        </Link>
      </div>
      <RecommendationRuleForm
        existing={existing}
        serviceOptions={serviceOptions}
        questionOptions={questionOptions}
      />
    </div>
  );
}
