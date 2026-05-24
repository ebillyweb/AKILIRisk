import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/admin/auth";
import { createPillarQuestion } from "@/lib/actions/admin-question-bank-actions";
import { RISK_AREAS } from "@/lib/advisor/types";
import { PillarQuestionBankFields } from "@/components/admin/PillarQuestionBankFields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPillarSectionsForRiskArea } from "@/lib/assessment/bank/pillar-sections-for-risk-area";
import { isRiskAreaId, legacyRiskAreaRedirect } from "@/lib/assessment/bank/risk-areas";
import { isPillarQuestionBankActive } from "@/lib/assessment/bank/question-bank-source";

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

  const legacy = legacyRiskAreaRedirect(riskAreaId);
  if (legacy) {
    redirect(`/admin/question-bank/${legacy}/new`);
  }

  if (!isRiskAreaId(riskAreaId)) {
    notFound();
  }

  const area = RISK_AREAS.find((a) => a.id === riskAreaId)!;
  const bankReady = await isPillarQuestionBankActive();
  const sections = await loadPillarSectionsForRiskArea(riskAreaId);

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

      {!bankReady ? (
        <Alert>
          <AlertTitle>Seed the question bank first</AlertTitle>
          <AlertDescription>
            Run <code className="text-xs">npm run seed:pillar-ddl</code> after migrations to load
            Belvedere categories, sections, and questions.
          </AlertDescription>
        </Alert>
      ) : null}

      {bankReady && sections.length === 0 ? (
        <Alert variant="destructive">
          <AlertTitle>No sections for this risk area</AlertTitle>
          <AlertDescription>
            Pillar DDL is seeded but {area.name} has no sections. Check category mappings in the
            seed SQL.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New question</CardTitle>
          <p className="text-sm text-muted-foreground">{area.name}</p>
        </CardHeader>
        <CardContent>
          <form action={createPillarQuestion} className="space-y-4">
            <input type="hidden" name="riskAreaId" value={riskAreaId} />
            <PillarQuestionBankFields
              mode="create"
              sections={sections}
              defaultSectionId={sections[0]?.id ?? ""}
              answerType="scored_0_3"
              defaultText=""
              defaultHelpText=""
              defaultLearnMore=""
              defaultRiskRelevance=""
              defaultAnswer0=""
              defaultAnswer1=""
              defaultAnswer2=""
              defaultAnswer3=""
              defaultCrossReference=""
              defaultQuestionNumber=""
              defaultIsSubQuestion={false}
              defaultDisplayOrder={0}
              defaultVisible
            />
            <Button type="submit" disabled={!bankReady || sections.length === 0}>
              Create question
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
