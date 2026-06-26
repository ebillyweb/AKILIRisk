import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  listQuestionsForRulePicker,
  listServiceRecommendationsForRulePicker,
} from "@/lib/admin/recommendation-queries";
import { RecommendationRuleForm } from "@/components/admin/RecommendationRuleForm";

export default async function NewRecommendationRulePage() {
  await requireAdminRole();
  const [serviceOptions, questionOptions] = await Promise.all([
    listServiceRecommendationsForRulePicker(),
    listQuestionsForRulePicker(),
  ]);
  return (
    <div className="space-y-6">
      <Link href="/admin/recommendations?view=rules" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to rules
      </Link>
      <RecommendationRuleForm
        existing={null}
        serviceOptions={serviceOptions}
        questionOptions={questionOptions}
      />
    </div>
  );
}
