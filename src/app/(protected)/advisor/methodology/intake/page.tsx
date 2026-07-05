import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { loadAdvisorIntakeQuestions } from "@/lib/methodology/methodology-queries";
import { resolveAdvisorIntakeQuestionBankMode } from "@/lib/methodology/intake-question-bank-mode.server";
import { Button } from "@/components/ui/button";
import { IntakeScriptEditor } from "@/components/advisor/methodology/IntakeScriptEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyIntakePage() {
  let profileId: string;
  let enterpriseId: string | null;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
    enterpriseId = profile.enterpriseId;
  } catch {
    redirect("/signin");
  }

  const [questions, bankMode] = await Promise.all([
    loadAdvisorIntakeQuestions(profileId),
    resolveAdvisorIntakeQuestionBankMode(profileId),
  ]);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Your methodology</Link>
      </Button>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        Edits apply to <strong>new intakes only</strong>. Clients already in progress keep the
        script snapshotted at intake start.
      </div>
      <ConfigurationPageHeader
        tourId="advisor-methodology-intake"
        title="Intake question bank"
        description="Use the platform question bank or a custom set — not both."
      />
      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Platform intake questions are loading. Refresh in a moment — if this persists, contact
          platform support.
        </div>
      ) : (
        <div data-tour="config-primary-form">
          <IntakeScriptEditor
            bankMode={bankMode}
            modeReadOnly={enterpriseId !== null}
            modeManagedByFirm={enterpriseId !== null}
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
            }))}
          />
        </div>
      )}
    </div>
  );
}
