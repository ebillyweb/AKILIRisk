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
      createDescription="Firm-wide custom questions sync to all member advisors. Platform questions can be edited or hidden but not removed."
      stockDescription="Platform questions ship with AkiliRisk or were inherited from the platform catalog. Edit or hide them for your firm — they cannot be deleted."
      actions={{
        updateQuestion: updateEnterprisePillarQuestion,
        createQuestion: createEnterprisePillarQuestion,
        deleteQuestion: deleteEnterprisePillarQuestion,
      }}
    />
  );
}
