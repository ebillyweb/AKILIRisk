"use client";

import { useState } from "react";
import { PROFILE_CONDITION_KEYS } from "@/lib/assessment/bank/behaviors";
import { FormHasCheckbox } from "@/components/admin/form-submission-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE_PROFILE = "__none__";

const QUESTION_TYPES = [
  { value: "yes-no", label: "Yes / No" },
  { value: "maturity-scale", label: "Maturity scale (0–3)" },
  { value: "likert", label: "Likert scale (1–5)" },
  { value: "single-choice", label: "Single choice" },
  { value: "numeric", label: "Numeric" },
  { value: "short-text", label: "Short text" },
] as const;

type Props = {
  defaultType?: string;
  defaultText?: string;
  defaultHelpText?: string;
  defaultLearnMore?: string;
  defaultRiskRelevance?: string;
  defaultWeight?: number;
  defaultRequired?: boolean;
  defaultOptionsJson?: string;
  defaultScoreMapJson?: string;
  defaultBranchingDependsOn?: string;
  defaultBranchingPredicateJson?: string;
  defaultProfileConditionKey?: string;
  showVisibleToggle?: boolean;
  defaultVisible?: boolean;
  defaultOmitMaturityScoreWhenYes?: boolean;
};

export function AssessmentBankQuestionFields({
  defaultType = "yes-no",
  defaultText = "",
  defaultHelpText = "",
  defaultLearnMore = "",
  defaultRiskRelevance = "",
  defaultWeight = 3,
  defaultRequired = true,
  defaultOptionsJson = "",
  defaultScoreMapJson = "",
  defaultBranchingDependsOn = "",
  defaultBranchingPredicateJson = "",
  defaultProfileConditionKey = "",
  showVisibleToggle = false,
  defaultVisible = true,
  defaultOmitMaturityScoreWhenYes = false,
}: Props) {
  const [questionType, setQuestionType] = useState(defaultType);
  const [profileConditionKey, setProfileConditionKey] = useState(
    defaultProfileConditionKey || ""
  );

  const profileSelectValue =
    profileConditionKey === "" ? NONE_PROFILE : profileConditionKey;

  return (
    <>
      <input type="hidden" name="type" value={questionType} />
      <div className="space-y-2">
        <Label htmlFor="type">Question type</Label>
        <Select value={questionType} onValueChange={setQuestionType}>
          <SelectTrigger id="type" className="w-full" aria-required>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">Question text</Label>
        <Textarea
          id="text"
          name="text"
          required
          rows={4}
          defaultValue={defaultText}
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="helpText">Help text</Label>
        <Textarea id="helpText" name="helpText" rows={3} defaultValue={defaultHelpText} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="learnMore">Learn more</Label>
        <Textarea id="learnMore" name="learnMore" rows={3} defaultValue={defaultLearnMore} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="riskRelevance">Why this matters (risk relevance)</Label>
        <Textarea
          id="riskRelevance"
          name="riskRelevance"
          rows={3}
          defaultValue={defaultRiskRelevance}
          placeholder="Shown in risk drivers when this question lands in the remediation band."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            name="weight"
            type="number"
            min={0}
            max={100}
            defaultValue={defaultWeight}
            required
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <FormHasCheckbox
            id="required"
            name="required"
            defaultChecked={defaultRequired}
            label="Required"
          />
        </div>
      </div>

      {showVisibleToggle ? (
        <FormHasCheckbox
          id="isVisible"
          name="isVisible"
          defaultChecked={defaultVisible}
          label="Visible to clients"
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="optionsJson">Options (JSON array)</Label>
        <Textarea
          id="optionsJson"
          name="optionsJson"
          rows={6}
          defaultValue={defaultOptionsJson}
          placeholder='[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Required for single-choice and maturity-scale. Left empty, yes-no uses standard Yes/No;
          numeric and short-text usually omit options.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scoreMapJson">Score map (JSON object)</Label>
        <Textarea
          id="scoreMapJson"
          name="scoreMapJson"
          rows={4}
          defaultValue={defaultScoreMapJson}
          placeholder='{"yes":10,"no":0}'
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Keys must match answer values (e.g. <code className="text-xs">yes</code>,{" "}
          <code className="text-xs">0</code>…<code className="text-xs">3</code>). Leave blank for
          defaults on yes-no and maturity-scale.
        </p>
      </div>

      <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
        <FormHasCheckbox
          id="omitMaturityScoreWhenYes"
          name="omitMaturityScoreWhenYes"
          defaultChecked={defaultOmitMaturityScoreWhenYes}
          label={
            <span className="font-medium">Yes/no gate: defer maturity when &quot;Yes&quot;</span>
          }
        />
        <p className="mt-2 pl-7 text-xs text-muted-foreground leading-relaxed">
          For gates with follow-up questions: do not roll &quot;Yes&quot; into the maturity score—only
          the follow-ups (levels 1–3) count. &quot;No&quot; still uses the score map (often N/A or zero
          maturity).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="branchingDependsOn">Branching: show after question ID (optional)</Label>
        <Input
          id="branchingDependsOn"
          name="branchingDependsOn"
          defaultValue={defaultBranchingDependsOn}
          placeholder="e.g. env-05"
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="branchingPredicateJson">Branching predicate (JSON, optional)</Label>
        <Textarea
          id="branchingPredicateJson"
          name="branchingPredicateJson"
          rows={2}
          defaultValue={defaultBranchingPredicateJson}
          placeholder='{"op":"equals","value":"yes"}'
          className="font-mono text-xs"
        />
      </div>

      <input type="hidden" name="profileConditionKey" value={profileConditionKey} />
      <div className="space-y-2">
        <Label htmlFor="profileConditionKey">Household profile condition (optional)</Label>
        <Select
          value={profileSelectValue}
          onValueChange={(v) =>
            setProfileConditionKey(v === NONE_PROFILE ? "" : v)
          }
        >
          <SelectTrigger id="profileConditionKey" className="w-full">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_PROFILE}>None</SelectItem>
            {PROFILE_CONDITION_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
