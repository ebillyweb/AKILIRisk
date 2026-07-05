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
}: {
  questions: IntakeQuestionRow[];
  bankMode: IntakeQuestionBankMode;
}) {
  return (
    <IntakeScriptEditor
      questions={questions}
      bankMode={bankMode}
      createDescription="Firm-wide custom questions sync to all member advisors."
      platformDescription="Use AkiliRisk platform intake questions for the whole firm. Edit or hide individual prompts — they cannot be deleted."
      customDescription="Use firm-defined custom intake questions only. Platform questions are not included while custom mode is active."
      actions={{
        updateQuestion: updateEnterpriseIntakeQuestion,
        createQuestion: createEnterpriseIntakeQuestion,
        deleteQuestion: deleteEnterpriseIntakeQuestion,
        updateBankMode: updateEnterpriseIntakeQuestionBankMode,
      }}
    />
  );
}
