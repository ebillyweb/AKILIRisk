"use client";

import {
  createEnterpriseIntakeQuestion,
  deleteEnterpriseIntakeQuestion,
  updateEnterpriseIntakeQuestion,
  updateEnterpriseIntakeQuestionBankMode,
} from "@/lib/actions/enterprise-methodology-actions";
import {
  IntakeScriptEditor,
  type IntakeQuestionRow,
} from "@/components/advisor/methodology/IntakeScriptEditor";
import type { IntakeQuestionBankMode } from "@prisma/client";

export function EnterpriseIntakeScriptEditor({
  questions,
  bankMode,
  savedCustomQuestionCount,
}: {
  questions: IntakeQuestionRow[];
  bankMode: IntakeQuestionBankMode;
  savedCustomQuestionCount: number;
}) {
  return (
    <IntakeScriptEditor
      questions={questions}
      bankMode={bankMode}
      savedCustomQuestionCount={savedCustomQuestionCount}
      firmScope
      createDescription="Firm-wide custom questions sync to all member advisors."
      platformDescription="Use AkiliRisk platform intake questions for the whole firm. Edit or hide individual prompts — they cannot be deleted."
      combinedDescription="Platform intake questions appear first for the firm, followed by firm custom prompts."
      customDescription="Use firm-defined custom intake questions only. Platform questions are not included while custom-only mode is active."
      actions={{
        updateQuestion: updateEnterpriseIntakeQuestion,
        createQuestion: createEnterpriseIntakeQuestion,
        deleteQuestion: deleteEnterpriseIntakeQuestion,
        updateBankMode: updateEnterpriseIntakeQuestionBankMode,
      }}
    />
  );
}
