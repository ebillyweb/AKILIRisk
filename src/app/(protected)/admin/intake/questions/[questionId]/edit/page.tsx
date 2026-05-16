import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getIntakeQuestionForAdmin } from "@/lib/admin/intake-questions-queries";
import { updateIntakePillarQuestionContent } from "@/lib/actions/admin-intake-questions-actions";
import { FormHasCheckbox } from "@/components/admin/form-submission-checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          View history (BRD §7.2)
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
          <CardTitle>Edit intake question</CardTitle>
          <CardDescription>
            Section: {question.section.name} · Pillar table <code className="text-xs">questions</code>{" "}
            (INTAKE category). Changes apply the next time the interview script is loaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateIntakePillarQuestionContent} className="space-y-6">
            <input type="hidden" name="questionId" value={question.id} />

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Recording tips</span> map to{" "}
                <code className="text-xs">recommended_actions</code>: one tip per line (or use
                bullets). The client interview splits them into the spoken tips list.
              </p>
              <p className="mt-2">
                <span className="font-medium text-foreground">Why this matters</span> feeds the TTS
                context when set; otherwise a neutral prompt is used.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionText">Question text (spoken)</Label>
              <Textarea
                id="questionText"
                name="questionText"
                required
                rows={5}
                defaultValue={question.questionText}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whyThisMatters">Why this matters (optional)</Label>
              <Textarea
                id="whyThisMatters"
                name="whyThisMatters"
                rows={3}
                defaultValue={question.whyThisMatters ?? ""}
                placeholder="Shown as tooltip; also used as TTS context when present."
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display order</Label>
                <Input
                  id="displayOrder"
                  name="displayOrder"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={question.displayOrder}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers sort earlier within the same section.
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
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/intake/questions">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        DDL fields such as <code className="rounded bg-muted px-1">answer_type</code> are not used
        by the audio intake flow; change them via SQL or the assessment question bank if needed.
      </p>
    </div>
  );
}
