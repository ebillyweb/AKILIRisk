"use client";

import { FormHasCheckbox } from "@/components/admin/form-submission-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  answerType: string;
  defaultText: string;
  defaultHelpText: string;
  defaultLearnMore: string;
  defaultRiskRelevance: string;
  defaultAnswer0: string;
  defaultAnswer1: string;
  defaultAnswer2: string;
  defaultAnswer3: string;
  defaultCrossReference: string;
  defaultQuestionNumber: string;
  defaultIsSubQuestion: boolean;
  defaultDisplayOrder: number;
};

export function PillarQuestionBankFields({
  answerType,
  defaultText,
  defaultHelpText,
  defaultLearnMore,
  defaultRiskRelevance,
  defaultAnswer0,
  defaultAnswer1,
  defaultAnswer2,
  defaultAnswer3,
  defaultCrossReference,
  defaultQuestionNumber,
  defaultIsSubQuestion,
  defaultDisplayOrder,
}: Props) {
  return (
    <>
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Pillar DDL row</p>
        <p className="mt-1">
          Stored in <code className="text-xs">questions</code>.{" "}
          <span className="tabular-nums">answer_type</span> is{" "}
          <code className="text-xs">{answerType}</code> (change via SQL or migration if needed).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">Question text</Label>
        <Textarea id="text" name="text" required rows={4} defaultValue={defaultText} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="helpText">Why this matters (help text)</Label>
        <Textarea id="helpText" name="helpText" rows={3} defaultValue={defaultHelpText} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="riskRelevance">Risk relevance (optional)</Label>
        <Textarea
          id="riskRelevance"
          name="riskRelevance"
          rows={2}
          defaultValue={defaultRiskRelevance}
          placeholder="Merged with help text into why_this_matters when saved."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="learnMore">Recommended actions (learn more)</Label>
        <Textarea id="learnMore" name="learnMore" rows={3} defaultValue={defaultLearnMore} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="answer0">Answer label 0</Label>
          <Input id="answer0" name="answer0" defaultValue={defaultAnswer0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="answer1">Answer label 1</Label>
          <Input id="answer1" name="answer1" defaultValue={defaultAnswer1} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="answer2">Answer label 2</Label>
          <Input id="answer2" name="answer2" defaultValue={defaultAnswer2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="answer3">Answer label 3</Label>
          <Input id="answer3" name="answer3" defaultValue={defaultAnswer3} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="crossReference">Cross-reference</Label>
        <Input id="crossReference" name="crossReference" defaultValue={defaultCrossReference} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="questionNumber">Question number (optional)</Label>
        <Input
          id="questionNumber"
          name="questionNumber"
          defaultValue={defaultQuestionNumber}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayOrder">Display order</Label>
        <Input
          id="displayOrder"
          name="displayOrder"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defaultDisplayOrder}
        />
        <p className="text-xs text-muted-foreground">
          Must stay unique within the section with other rows (database constraint).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <FormHasCheckbox
          id="isSubQuestion"
          name="isSubQuestion"
          defaultChecked={defaultIsSubQuestion}
          label="Sub-question"
        />
      </div>
    </>
  );
}
