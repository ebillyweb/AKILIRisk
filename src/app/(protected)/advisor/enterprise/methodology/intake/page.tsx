import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { loadEnterpriseIntakeQuestions, countEnterpriseCustomIntakeQuestions } from "@/lib/methodology/enterprise-methodology-queries";
import { ensureEnterpriseIntakeQuestionBankModeValid } from "@/lib/methodology/intake-question-bank-mode.server";
import { Button } from "@/components/ui/button";
import { EnterpriseIntakeScriptEditor } from "@/components/advisor/enterprise/EnterpriseIntakeScriptEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseMethodologyIntakePage() {
  let enterpriseId: string;
  let enterpriseName: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseId = team.enterpriseId;
    enterpriseName = team.enterpriseName;
  } catch {
    redirect("/signin");
  }

  const [questions, bankModeState, savedCustomQuestionCount] = await Promise.all([
    loadEnterpriseIntakeQuestions(enterpriseId),
    ensureEnterpriseIntakeQuestionBankModeValid(enterpriseId),
    countEnterpriseCustomIntakeQuestions(enterpriseId),
  ]);
  const bankMode = bankModeState.bankMode;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/enterprise/methodology">Practice Standards</Link>
      </Button>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        Edits apply to <strong>new intakes only</strong>. Clients already in progress keep the
        script snapshotted at intake start. Changes sync to all firm advisors.
      </div>
      <ConfigurationPageHeader
        tourId="advisor-methodology-intake"
        title={`${enterpriseName} — Intake question bank`}
        description="Platform is the default firm bank. Combined or custom only when needed."
      />
      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Platform intake questions are loading. Refresh in a moment — if this persists, contact
          platform support.
        </div>
      ) : (
        <div data-tour="config-primary-form">
          <EnterpriseIntakeScriptEditor
            bankMode={bankMode}
            savedCustomQuestionCount={savedCustomQuestionCount}
            questions={questions.map((q) => ({
              id: q.id,
              sourceKind: q.sourceKind,
              displayOrder: q.displayOrder,
              questionText: q.questionText,
              context: q.context,
              isVisible: q.isVisible,
              answerType: q.answerType,
              answer0: q.answer0,
              answer1: q.answer1,
              answer2: q.answer2,
              answer3: q.answer3,
              options: q.options,
            }))}
          />
        </div>
      )}
    </div>
  );
}
