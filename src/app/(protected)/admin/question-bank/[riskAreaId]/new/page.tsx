import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/admin/auth";
import { createAssessmentBankQuestion } from "@/lib/actions/admin-question-bank-actions";
import { RISK_AREAS } from "@/lib/advisor/types";
import { AssessmentBankQuestionFields } from "@/components/admin/AssessmentBankQuestionFields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRiskAreaId, legacyRiskAreaRedirect } from "@/lib/assessment/bank/risk-areas";
import { prisma } from "@/lib/db";

export default async function AdminQuestionBankNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireAdminRole();
  const { riskAreaId } = await params;
  const { err } = await searchParams;

  // F2 / BRD §4.1 — old bookmark URL? 302 to the current ID instead of 404.
  const legacy = legacyRiskAreaRedirect(riskAreaId);
  if (legacy) {
    redirect(`/admin/question-bank/${legacy}/new`);
  }

  if (!isRiskAreaId(riskAreaId)) {
    notFound();
  }

  const area = RISK_AREAS.find((a) => a.id === riskAreaId)!;

  const pillarBankDisabled = process.env.USE_PILLAR_QUESTION_BANK?.trim() === "0";
  const pillarQuestionCount = await prisma.pillarQuestion.count();
  const pillarOverridesAssessmentBank =
    !pillarBankDisabled && pillarQuestionCount > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/question-bank/${riskAreaId}`}>Back to {area.name}</Link>
        </Button>
      </div>

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not create question</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {pillarOverridesAssessmentBank ? (
        <Alert>
          <AlertTitle>Pillar DDL is the live question bank</AlertTitle>
          <AlertDescription>
            The <code className="text-xs">questions</code> table has {pillarQuestionCount} row
            {pillarQuestionCount === 1 ? "" : "s"} and <code className="text-xs">USE_PILLAR_QUESTION_BANK</code>{" "}
            is not <code className="text-xs">0</code>, so client assessments load from pillar DDL first.
            New rows here only update <code className="text-xs">AssessmentBankQuestion</code>—they will
            not appear in the live assessment for this pillar unless you disable the pillar bank or add
            matching pillar rows. Prefer editing existing pillar questions from the area list, or use{" "}
            <code className="text-xs">npm run seed:pillar-ddl</code> for bulk changes.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New question</CardTitle>
          <p className="text-sm text-muted-foreground">{area.name}</p>
        </CardHeader>
        <CardContent>
          <form action={createAssessmentBankQuestion} className="space-y-4">
            <input type="hidden" name="riskAreaId" value={riskAreaId} />
            <AssessmentBankQuestionFields showVisibleToggle defaultVisible />
            <Button type="submit">Create question</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
