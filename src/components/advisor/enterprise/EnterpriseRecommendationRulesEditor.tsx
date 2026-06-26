"use client";

import {
  createEnterpriseRecommendationRule,
  deleteEnterpriseRecommendationRule,
  updateEnterpriseRecommendationRule,
} from "@/lib/actions/enterprise-recommendation-actions";
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

export function EnterpriseRecommendationRulesEditor({
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
      createDescription="Firm-wide custom rules sync to all member advisors. Members inherit these defaults and can further adjust their own copies. Platform base rules can be edited or deactivated but not removed."
      actions={{
        updateRule: updateEnterpriseRecommendationRule,
        createRule: createEnterpriseRecommendationRule,
        deleteRule: deleteEnterpriseRecommendationRule,
      }}
    />
  );
}
