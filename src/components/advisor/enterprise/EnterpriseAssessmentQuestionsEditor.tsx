"use client";

import {
  createEnterprisePillarQuestion,
  deleteEnterprisePillarQuestion,
  updateEnterprisePillarQuestion,
} from "@/lib/actions/enterprise-methodology-actions";
import {
  AssessmentQuestionsEditor,
  type AssessmentQuestionRow,
} from "@/components/advisor/methodology/AssessmentQuestionsEditor";

export function EnterpriseAssessmentQuestionsEditor({
  pillarSlug,
  questions,
}: {
  pillarSlug: string;
  questions: AssessmentQuestionRow[];
}) {
  return (
    <AssessmentQuestionsEditor
      pillarSlug={pillarSlug}
      questions={questions}
      createDescription="Firm-wide custom questions sync to all member advisors. Platform base questions can be edited or hidden but not removed."
      actions={{
        updateQuestion: updateEnterprisePillarQuestion,
        createQuestion: createEnterprisePillarQuestion,
        deleteQuestion: deleteEnterprisePillarQuestion,
      }}
    />
  );
}
