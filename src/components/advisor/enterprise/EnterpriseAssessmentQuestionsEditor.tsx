"use client";

import {
  createEnterprisePillarQuestion,
  deleteEnterprisePillarQuestion,
  updateEnterpriseAssessmentQuestionBankMode,
  updateEnterprisePillarQuestion,
} from "@/lib/actions/enterprise-methodology-actions";
import {
  AssessmentQuestionsEditor,
  type AssessmentQuestionRow,
} from "@/components/advisor/methodology/AssessmentQuestionsEditor";
import type { IntakeQuestionBankMode } from "@prisma/client";

export function EnterpriseAssessmentQuestionsEditor({
  pillarSlug,
  questions,
  bankMode,
  totalCustomQuestionCount,
}: {
  pillarSlug: string;
  questions: AssessmentQuestionRow[];
  bankMode: IntakeQuestionBankMode;
  totalCustomQuestionCount: number;
}) {
  return (
    <AssessmentQuestionsEditor
      pillarSlug={pillarSlug}
      questions={questions}
      bankMode={bankMode}
      firmScope
      totalCustomQuestionCount={totalCustomQuestionCount}
      createDescription="Firm-wide custom questions sync to all member advisors."
      platformDescription="Use AkiliRisk platform assessment questions for the whole firm. Edit or hide individual prompts — they cannot be deleted."
      combinedDescription="Platform assessment questions appear first for the firm, followed by firm custom prompts in each risk domain."
      customDescription="Use firm-defined custom assessment questions only. Platform questions are not included while custom-only mode is active."
      actions={{
        updateQuestion: updateEnterprisePillarQuestion,
        createQuestion: createEnterprisePillarQuestion,
        deleteQuestion: deleteEnterprisePillarQuestion,
        updateBankMode: updateEnterpriseAssessmentQuestionBankMode,
      }}
    />
  );
}
