import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { loadAdvisorIntakeQuestions } from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";
import { IntakeScriptEditor } from "@/components/advisor/methodology/IntakeScriptEditor";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyIntakePage() {
  let profileId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
  } catch {
    redirect("/signin");
  }

  const questions = await loadAdvisorIntakeQuestions(profileId);

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
        title="Intake script"
        description="Edit or hide platform base questions, or add custom audio prompts for your clients."
      />
      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Platform intake questions are loading. Refresh in a moment — if this persists, contact
          platform support.
        </div>
      ) : (
        <div data-tour="config-primary-form">
          <IntakeScriptEditor
          questions={questions.map((q) => ({
            id: q.id,
            sourceKind: q.sourceKind,
            displayOrder: q.displayOrder,
            questionText: q.questionText,
            context: q.context,
            isVisible: q.isVisible,
          }))}
          />
        </div>
      )}
    </div>
  );
}
