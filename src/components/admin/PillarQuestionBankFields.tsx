"use client";

import { FormHasCheckbox } from "@/components/admin/form-submission-checkbox";
import {
  formatQuestionTextForDisplay,
  getAnswerOptionFields,
} from "@/lib/assessment/bank/question-bank-display";
import { Input } from "@/components/ui/input";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
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
  /** BRD §6.2 / Epic 5.10 US-72: Key Risk Indicator flag. */
  defaultIsKeyRiskIndicator?: boolean;
};

const ANSWER_TYPE_OPTIONS = [
  { value: "scored_0_3", label: "Maturity scale (0–3)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "likert_5", label: "Likert (1–5)" },
  { value: "scale_1_5", label: "Scale 1–5 (single choice)" },
  { value: "fillable", label: "Short text" },
  { value: "number", label: "Numeric" },
  { value: "date", label: "Date (calendar)" },
  { value: "date_mm_yyyy", label: "Date (MM/YYYY)" },
] as const;

const selectClassName = cn(
  "flex h-12 w-full rounded-xl border border-input bg-card/80 px-4 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:text-sm",
  "focus-visible:border-brand/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/20"
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
  defaultIsKeyRiskIndicator = false,
}: Props) {
  const isCreate = mode === "create";
  const answerOptions = getAnswerOptionFields(answerType, {
    answer0: defaultAnswer0,
    answer1: defaultAnswer1,
    answer2: defaultAnswer2,
    answer3: defaultAnswer3,
  });

  return (
    <>
      {isCreate ? (
        <>
          <div className="space-y-2">
            <LabelWithHelp htmlFor="sectionId" helpKey="bank-section">
              Section
            </LabelWithHelp>
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
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <LabelWithHelp htmlFor="answerType" helpKey="bank-answer-type">
              How clients answer
            </LabelWithHelp>
            <select
              id="answerType"
              name="answerType"
              defaultValue="scored_0_3"
              className={selectClassName}
            >
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
            <FieldHelp helpKey="bank-visible" triggerLabel="Visible to new assessments" />
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <LabelWithHelp htmlFor="text" helpKey="bank-question-text">
          Question
        </LabelWithHelp>
        <Textarea
          id="text"
          name="text"
          required
          rows={4}
          defaultValue={formatQuestionTextForDisplay(defaultText)}
        />
      </div>

      <div className="space-y-2">
        <LabelWithHelp htmlFor="helpText" helpKey="bank-help-text">
          Why this matters
        </LabelWithHelp>
        <Textarea
          id="helpText"
          name="helpText"
          rows={3}
          defaultValue={defaultHelpText}
          placeholder="Help clients understand why this question matters."
        />
      </div>

      <div className="space-y-2">
        <LabelWithHelp htmlFor="riskRelevance" helpKey="bank-risk-relevance">
          Additional context (optional)
        </LabelWithHelp>
        <Textarea
          id="riskRelevance"
          name="riskRelevance"
          rows={2}
          defaultValue={defaultRiskRelevance}
          placeholder="Extra guidance shown with the help text, if needed."
        />
      </div>

      <div className="space-y-2">
        <LabelWithHelp htmlFor="learnMore" helpKey="bank-learn-more">
          Recommended actions
        </LabelWithHelp>
        <Textarea
          id="learnMore"
          name="learnMore"
          rows={3}
          defaultValue={defaultLearnMore}
          placeholder="Practical steps or resources for the client."
        />
      </div>

      {answerOptions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Answer choices</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {answerOptions.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  defaultValue={field.defaultValue}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <details className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">
          Advanced options
        </summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <LabelWithHelp htmlFor="crossReference" helpKey="bank-cross-reference">
              Cross-reference (optional)
            </LabelWithHelp>
            <Input
              id="crossReference"
              name="crossReference"
              defaultValue={defaultCrossReference}
              placeholder="Link to a related question, if any"
            />
          </div>

          <div className="space-y-2">
            <LabelWithHelp htmlFor="questionNumber" helpKey="bank-question-number">
              Question number (optional)
            </LabelWithHelp>
            <Input
              id="questionNumber"
              name="questionNumber"
              defaultValue={defaultQuestionNumber}
            />
          </div>

          {!isCreate ? (
            <div className="space-y-2">
              <LabelWithHelp htmlFor="displayOrder" helpKey="bank-display-order">
                Order in section
              </LabelWithHelp>
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
                You can also reorder from the question list using the arrow buttons.
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <FormHasCheckbox
              id="isSubQuestion"
              name="isSubQuestion"
              defaultChecked={defaultIsSubQuestion}
              label="Sub-question (nested under a parent question)"
            />
            <FieldHelp helpKey="bank-sub-question" triggerLabel="Sub-question" />
          </div>
          <div className="flex items-center gap-2">
            <FormHasCheckbox
              id="isKeyRiskIndicator"
              name="isKeyRiskIndicator"
              defaultChecked={defaultIsKeyRiskIndicator}
              label="Key Risk Indicator (fires an upsell trigger at answer ≤ 1)"
            />
            <FieldHelp helpKey="bank-key-risk-indicator" triggerLabel="Key Risk Indicator" />
          </div>
        </div>
      </details>
    </>
  );
}
