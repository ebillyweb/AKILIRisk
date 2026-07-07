"use client";

import {
  createAdvisorRecommendationRule,
  deleteAdvisorRecommendationRule,
  updateAdvisorRecommendationRule,
} from "@/lib/actions/methodology-actions";
import type { RulePickerQuestion } from "@/lib/admin/recommendation-rule-ui";
import {
  RecommendationRulesEditorShared,
  type RecommendationRuleEditorRow,
} from "@/components/advisor/methodology/RecommendationRulesEditorShared";

type ServiceOption = {
  id: string;
  name: string;
  category: string;
};

export function RecommendationRulesEditor({
  pillarSlug,
  rules,
  services,
  questionOptions,
}: {
  pillarSlug: string;
  rules: RecommendationRuleEditorRow[];
  services: ServiceOption[];
  questionOptions: RulePickerQuestion[];
}) {
  return (
    <RecommendationRulesEditorShared
      pillarSlug={pillarSlug}
      rules={rules}
      services={services}
      questionOptions={questionOptions}
      createDescription="Custom rules apply to new intakes only and are visible only to your clients. Platform base rules can be edited or deactivated but not removed."
      actions={{
        updateRule: updateAdvisorRecommendationRule,
        createRule: createAdvisorRecommendationRule,
        deleteRule: deleteAdvisorRecommendationRule,
      }}
    />
  );
}
