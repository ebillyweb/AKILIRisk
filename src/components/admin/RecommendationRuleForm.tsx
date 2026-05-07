"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recommendationRuleInputSchema,
  type RecommendationRuleInput,
} from "@/lib/admin/recommendation-rule-schemas";
import {
  createRecommendationRule,
  updateRecommendationRule,
} from "@/lib/actions/admin-recommendation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceOption {
  id: string;
  name: string;
  category: string;
}

interface RuleFormProps {
  /** Existing rule (edit) or null (create). */
  existing:
    | (Omit<Partial<RecommendationRuleInput>, "triggerConditions" | "pillarThresholds" | "questionConditions"> & {
        id: string;
        triggerConditions: unknown;
        pillarThresholds?: unknown;
        questionConditions?: unknown;
      })
    | null;
  /** Active services to pick from in the parent dropdown. */
  serviceOptions: ServiceOption[];
}

const CONDITION_PLACEHOLDER = `[
  {
    "type": "score_threshold",
    "pillarId": "cyber-digital",
    "operator": "less_than",
    "value": 1.8,
    "weight": 3
  },
  {
    "type": "risk_level",
    "pillarId": "cyber-digital",
    "operator": "in",
    "value": ["high", "critical"],
    "weight": 2
  }
]`;

const THRESHOLDS_PLACEHOLDER = `{
  "cyber-digital": { "min": 1.8, "max": 2.4 }
}`;

/**
 * C1 (BRD §4.4): admin form for RecommendationRule create + edit.
 *
 * `triggerConditions` and `pillarThresholds` are edited as JSON in
 * textareas. We Zod-parse on submit so format errors surface as
 * "score_threshold needs a pillarId" or "Contradictory pair on pillar
 * cybersecurity..." rather than a stack trace.
 */
export function RecommendationRuleForm({ existing, serviceOptions }: RuleFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const isEdit = !!existing;

  function onSubmit(formData: FormData) {
    setErrors({});
    setTopError(null);

    const triggerConditionsRaw = String(formData.get("triggerConditions") ?? "[]").trim();
    const pillarThresholdsRaw = String(formData.get("pillarThresholds") ?? "").trim();
    const questionConditionsRaw = String(formData.get("questionConditions") ?? "").trim();

    let triggerConditions: unknown;
    try {
      triggerConditions = JSON.parse(triggerConditionsRaw);
    } catch (err) {
      setErrors({ triggerConditions: `Invalid JSON: ${(err as Error).message}` });
      return;
    }
    if (!Array.isArray(triggerConditions)) {
      setErrors({ triggerConditions: "Expected an array of condition objects" });
      return;
    }

    let pillarThresholds: unknown = null;
    if (pillarThresholdsRaw) {
      try {
        pillarThresholds = JSON.parse(pillarThresholdsRaw);
      } catch (err) {
        setErrors({ pillarThresholds: `Invalid JSON: ${(err as Error).message}` });
        return;
      }
    }

    let questionConditions: unknown = null;
    if (questionConditionsRaw) {
      try {
        questionConditions = JSON.parse(questionConditionsRaw);
      } catch (err) {
        setErrors({ questionConditions: `Invalid JSON: ${(err as Error).message}` });
        return;
      }
    }

    const raw = {
      serviceRecommendationId: String(formData.get("serviceRecommendationId") ?? ""),
      ruleName: String(formData.get("ruleName") ?? ""),
      description: (formData.get("description") || null) as string | null,
      triggerConditions,
      pillarThresholds,
      questionConditions,
      priority: Number(formData.get("priority") ?? 0),
      isActive: formData.get("isActive") === "on",
    };

    const parsed = recommendationRuleInputSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        // Map nested triggerConditions[N].fieldname errors onto the
        // textarea so admins see the message inline. Multiple errors get
        // joined with line breaks.
        const path = issue.path.join(".") || "_";
        const key = path.startsWith("triggerConditions") ? "triggerConditions" : path;
        fieldErrors[key] = fieldErrors[key]
          ? `${fieldErrors[key]}\n• ${path}: ${issue.message}`
          : `• ${path}: ${issue.message}`;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateRecommendationRule({ ...parsed.data, id: existing!.id })
        : await createRecommendationRule(parsed.data);
      if (result.success) {
        router.push("/admin/recommendations?view=rules");
        router.refresh();
      } else {
        setTopError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit rule" : "New rule"}</CardTitle>
      </CardHeader>
      <CardContent>
        {topError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {topError}
          </div>
        )}
        <form action={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="serviceRecommendationId" className="block text-sm font-medium mb-1">
              Service recommendation
            </label>
            <select
              id="serviceRecommendationId"
              name="serviceRecommendationId"
              defaultValue={existing?.serviceRecommendationId ?? ""}
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${errors.serviceRecommendationId ? "border-destructive" : "border-input"}`}
            >
              <option value="">— pick a service —</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.category}] {s.name}
                </option>
              ))}
            </select>
            {errors.serviceRecommendationId && (
              <p className="mt-1 text-xs text-destructive">{errors.serviceRecommendationId}</p>
            )}
          </div>

          <div>
            <label htmlFor="ruleName" className="block text-sm font-medium mb-1">Rule name</label>
            <input
              id="ruleName"
              name="ruleName"
              defaultValue={existing?.ruleName ?? ""}
              className={`w-full rounded-md border px-3 py-2 text-sm ${errors.ruleName ? "border-destructive" : "border-input"}`}
            />
            {errors.ruleName && <p className="mt-1 text-xs text-destructive">{errors.ruleName}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={(existing?.description ?? "") as string}
              className={`w-full rounded-md border px-3 py-2 text-sm ${errors.description ? "border-destructive" : "border-input"}`}
            />
          </div>

          <div>
            <label htmlFor="triggerConditions" className="block text-sm font-medium mb-1">
              Trigger conditions (JSON)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Array of <code>{"{ type, pillarId | questionId | field, operator, value, weight }"}</code> objects.
              Types: score_threshold, risk_level, answer_match, missing_control, profile_condition.
              Engine matches when &gt;50% of the weighted conditions are satisfied.
            </p>
            <textarea
              id="triggerConditions"
              name="triggerConditions"
              rows={12}
              defaultValue={existing?.triggerConditions ? JSON.stringify(existing.triggerConditions, null, 2) : CONDITION_PLACEHOLDER}
              className={`w-full rounded-md border px-3 py-2 text-xs font-mono ${errors.triggerConditions ? "border-destructive" : "border-input"}`}
            />
            {errors.triggerConditions && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive">{errors.triggerConditions}</pre>
            )}
          </div>

          <div>
            <label htmlFor="pillarThresholds" className="block text-sm font-medium mb-1">
              Pillar thresholds (optional, JSON)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              <code>{"{ pillarId: { min, max } }"}</code> — informational metadata; not consumed by the
              current engine.
            </p>
            <textarea
              id="pillarThresholds"
              name="pillarThresholds"
              rows={5}
              defaultValue={existing?.pillarThresholds ? JSON.stringify(existing.pillarThresholds, null, 2) : ""}
              placeholder={THRESHOLDS_PLACEHOLDER}
              className={`w-full rounded-md border px-3 py-2 text-xs font-mono ${errors.pillarThresholds ? "border-destructive" : "border-input"}`}
            />
            {errors.pillarThresholds && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive">{errors.pillarThresholds}</pre>
            )}
          </div>

          <div>
            <label htmlFor="questionConditions" className="block text-sm font-medium mb-1">
              Question conditions (optional, JSON)
            </label>
            <textarea
              id="questionConditions"
              name="questionConditions"
              rows={3}
              defaultValue={existing?.questionConditions ? JSON.stringify(existing.questionConditions, null, 2) : ""}
              className={`w-full rounded-md border px-3 py-2 text-xs font-mono ${errors.questionConditions ? "border-destructive" : "border-input"}`}
            />
            {errors.questionConditions && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive">{errors.questionConditions}</pre>
            )}
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium mb-1">Priority (higher = surfaces first)</label>
            <input
              id="priority"
              name="priority"
              type="number"
              defaultValue={String(existing?.priority ?? 1)}
              className={`w-full rounded-md border px-3 py-2 text-sm ${errors.priority ? "border-destructive" : "border-input"}`}
            />
            {errors.priority && <p className="mt-1 text-xs text-destructive">{errors.priority}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={existing?.isActive !== false} />
            Active (engine evaluates this rule)
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
