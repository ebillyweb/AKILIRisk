import { PROFILE_CONDITION_KEYS } from "@/lib/assessment/bank/behaviors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fieldSelectClass = cn(
  "border-input h-11 w-full min-w-0 rounded-xl border bg-card/80 px-4 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-all outline-none md:text-sm",
  "focus-visible:border-brand/50 focus-visible:ring-brand/20 focus-visible:ring-[3px]",
);

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
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="type">Question type</Label>
        <select
          id="type"
          name="type"
          defaultValue={defaultType}
          required
          className={fieldSelectClass}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
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
          <div className="flex items-center gap-2">
            <input
              id="required"
              name="required"
              type="checkbox"
              defaultChecked={defaultRequired}
              className="size-4 rounded border-input accent-primary"
            />
            <Label htmlFor="required" className="cursor-pointer font-normal">
              Required
            </Label>
          </div>
        </div>
      </div>

      {showVisibleToggle ? (
        <div className="flex items-center gap-2">
          <input
            id="isVisible"
            name="isVisible"
            type="checkbox"
            defaultChecked={defaultVisible}
            className="size-4 rounded border-input accent-primary"
          />
          <Label htmlFor="isVisible" className="cursor-pointer font-normal">
            Visible to clients
          </Label>
        </div>
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

      <div className="flex items-start gap-2 rounded-xl border border-border/80 bg-muted/20 p-3">
        <input
          id="omitMaturityScoreWhenYes"
          name="omitMaturityScoreWhenYes"
          type="checkbox"
          defaultChecked={defaultOmitMaturityScoreWhenYes}
          className="mt-1 size-4 rounded border-input accent-primary"
        />
        <div className="space-y-1">
          <Label htmlFor="omitMaturityScoreWhenYes" className="cursor-pointer font-medium">
            Yes/no gate: defer maturity when &quot;Yes&quot;
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            For gates with follow-up questions: do not roll &quot;Yes&quot; into the maturity score—only
            the follow-ups (levels 1–3) count. &quot;No&quot; still uses the score map (often N/A or zero
            maturity).
          </p>
        </div>
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

      <div className="space-y-2">
        <Label htmlFor="profileConditionKey">Household profile condition (optional)</Label>
        <select
          id="profileConditionKey"
          name="profileConditionKey"
          defaultValue={defaultProfileConditionKey || ""}
          className={fieldSelectClass}
        >
          <option value="">None</option>
          {PROFILE_CONDITION_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
