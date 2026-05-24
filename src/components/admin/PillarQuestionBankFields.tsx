"use client";

import { FormHasCheckbox } from "@/components/admin/form-submission-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SectionOption = {
  id: string;
  code: string;
  name: string;
  categoryCode: string;
};

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
  mode?: "edit" | "create";
  sections?: SectionOption[];
  defaultSectionId?: string;
  defaultVisible?: boolean;
};

const ANSWER_TYPE_OPTIONS = [
  { value: "scored_0_3", label: "Maturity scale (0–3)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "likert_5", label: "Likert (1–5)" },
  { value: "scale_1_5", label: "Scale 1–5 (single choice)" },
  { value: "fillable", label: "Short text" },
  { value: "number", label: "Numeric" },
  { value: "date_mm_yyyy", label: "Date (MM/YYYY)" },
] as const;

const selectClassName = cn(
  "flex h-12 w-full rounded-xl border border-input bg-card/80 px-4 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:text-sm",
  "focus-visible:border-brand/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/20",
);

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
  mode = "edit",
  sections = [],
  defaultSectionId = "",
  defaultVisible = true,
}: Props) {
  const isCreate = mode === "create";

  return (
    <>
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Pillar question bank</p>
        <p className="mt-1">
          Stored in <code className="text-xs">questions</code>. This is the live source clients
          receive when pillar DDL is seeded.
        </p>
      </div>

      {isCreate ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="sectionId">Section</Label>
            <select
              id="sectionId"
              name="sectionId"
              required
              defaultValue={defaultSectionId}
              className={selectClassName}
            >
              <option value="" disabled>
                Choose a section
              </option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.categoryCode} · {section.code} — {section.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="answerType">Answer type</Label>
            <select id="answerType" name="answerType" defaultValue="scored_0_3" className={selectClassName}>
              {ANSWER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FormHasCheckbox
              id="isVisible"
              name="isVisible"
              defaultChecked={defaultVisible}
              label="Visible to new assessments"
            />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
          <p>
            <span className="tabular-nums">answer_type</span> is{" "}
            <code className="text-xs">{answerType}</code> (change via create flow or SQL if needed).
          </p>
        </div>
      )}

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

      {!isCreate ? (
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
      ) : null}

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
