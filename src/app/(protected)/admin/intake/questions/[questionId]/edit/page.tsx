import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getIntakeQuestionForAdmin } from "@/lib/admin/intake-questions-queries";
import { updateIntakePillarQuestionContent } from "@/lib/actions/admin-intake-questions-actions";
import { FormHasCheckbox } from "@/components/admin/form-submission-checkbox";
import { IntakeRelatedPillarsField } from "@/components/admin/IntakeRelatedPillarsField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function AdminIntakeQuestionEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { questionId } = await params;
  const sp = await searchParams;
  const question = await getIntakeQuestionForAdmin(questionId);
  if (!question) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/intake/questions" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to intake script
          </Link>
        </Button>
        <Link
          href={`/admin/audit-log/entity/PillarQuestion/${questionId}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View history
        </Link>
      </div>

      {sp.err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{sp.err}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit intake question</CardTitle>
          <p className="text-sm text-muted-foreground">{question.section.name}</p>
        </CardHeader>
        <CardContent>
          <form action={updateIntakePillarQuestionContent} className="space-y-6">
            <input type="hidden" name="questionId" value={question.id} />

            <div className="space-y-2">
              <Label htmlFor="questionText">Question text</Label>
              <Textarea
                id="questionText"
                name="questionText"
                required
                rows={5}
                defaultValue={question.questionText}
              />
              <p className="text-xs text-muted-foreground">
                Spoken aloud during the client interview.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whyThisMatters">Why we ask (optional)</Label>
              <Textarea
                id="whyThisMatters"
                name="whyThisMatters"
                rows={3}
                defaultValue={question.whyThisMatters ?? ""}
                placeholder="Shown as a tooltip for advisors; also used as spoken context when set."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordingTips">Recording tips (optional)</Label>
              <Textarea
                id="recordingTips"
                name="recordingTips"
                rows={4}
                defaultValue={question.recommendedActions ?? ""}
                placeholder={"One tip per line, e.g.\nSpeak clearly\nInclude examples"}
              />
              <p className="text-xs text-muted-foreground">
                Shown to the client before they record; one tip per line.
              </p>
            </div>

            <IntakeRelatedPillarsField
              defaultSelected={question.relatedPillarIds ?? []}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Order in script</Label>
                <Input
                  id="displayOrder"
                  name="displayOrder"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={question.displayOrder}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear earlier within the same section.
                </p>
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium leading-none">Interview visibility</span>
                <FormHasCheckbox
                  id="isVisible"
                  name="isVisible"
                  defaultChecked={question.isVisible}
                  className="pt-2"
                  label="Include in client intake script"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save changes</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/intake/questions">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
