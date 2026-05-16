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
import { FormOnCheckbox } from "@/components/admin/form-submission-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServiceOption {
  id: string;
  name: string;
  category: string;
}

const SERVICE_NONE = "__none__";

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
  const [serviceRecommendationId, setServiceRecommendationId] = useState(
    existing?.serviceRecommendationId ?? ""
  );

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
          <input
            type="hidden"
            name="serviceRecommendationId"
            value={serviceRecommendationId}
          />
          <div>
            <label htmlFor="serviceRecommendationId" className="mb-1 block text-sm font-medium">
              Service recommendation
            </label>
            <Select
              value={
                serviceRecommendationId === "" ? SERVICE_NONE : serviceRecommendationId
              }
              onValueChange={(v) =>
                setServiceRecommendationId(v === SERVICE_NONE ? "" : v)
              }
              disabled={pending}
            >
              <SelectTrigger
                id="serviceRecommendationId"
                className={
                  errors.serviceRecommendationId ? "w-full border-destructive" : "w-full"
                }
                aria-invalid={errors.serviceRecommendationId ? true : undefined}
              >
                <SelectValue placeholder="— pick a service —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SERVICE_NONE}>— pick a service —</SelectItem>
                {serviceOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    [{s.category}] {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.serviceRecommendationId && (
              <p className="mt-1 text-xs text-destructive">{errors.serviceRecommendationId}</p>
            )}
          </div>

          <div>
            <label htmlFor="ruleName" className="mb-1 block text-sm font-medium">Rule name</label>
            <Input
              id="ruleName"
              name="ruleName"
              defaultValue={existing?.ruleName ?? ""}
              aria-invalid={errors.ruleName ? true : undefined}
              className={errors.ruleName ? "border-destructive" : undefined}
            />
            {errors.ruleName && <p className="mt-1 text-xs text-destructive">{errors.ruleName}</p>}
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium">Description (optional)</label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={(existing?.description ?? "") as string}
              aria-invalid={errors.description ? true : undefined}
              className={errors.description ? "border-destructive" : undefined}
            />
          </div>

          <div>
            <label htmlFor="triggerConditions" className="mb-1 block text-sm font-medium">
              Trigger conditions (JSON)
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Array of <code>{"{ type, pillarId | questionId | field, operator, value, weight }"}</code> objects.
              Types: score_threshold, risk_level, answer_match, missing_control, profile_condition.
              Engine matches when &gt;50% of the weighted conditions are satisfied.
            </p>
            <Textarea
              id="triggerConditions"
              name="triggerConditions"
              rows={12}
              defaultValue={existing?.triggerConditions ? JSON.stringify(existing.triggerConditions, null, 2) : CONDITION_PLACEHOLDER}
              aria-invalid={errors.triggerConditions ? true : undefined}
              className={`font-mono text-xs ${errors.triggerConditions ? "border-destructive" : ""}`}
            />
            {errors.triggerConditions && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive">{errors.triggerConditions}</pre>
            )}
          </div>

          <div>
            <label htmlFor="pillarThresholds" className="mb-1 block text-sm font-medium">
              Pillar thresholds (optional, JSON)
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              <code>{"{ pillarId: { min, max } }"}</code> — informational metadata; not consumed by the
              current engine.
            </p>
            <Textarea
              id="pillarThresholds"
              name="pillarThresholds"
              rows={5}
              defaultValue={existing?.pillarThresholds ? JSON.stringify(existing.pillarThresholds, null, 2) : ""}
              placeholder={THRESHOLDS_PLACEHOLDER}
              aria-invalid={errors.pillarThresholds ? true : undefined}
              className={`font-mono text-xs ${errors.pillarThresholds ? "border-destructive" : ""}`}
            />
            {errors.pillarThresholds && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive">{errors.pillarThresholds}</pre>
            )}
          </div>

          <div>
            <label htmlFor="questionConditions" className="mb-1 block text-sm font-medium">
              Question conditions (optional, JSON)
            </label>
            <Textarea
              id="questionConditions"
              name="questionConditions"
              rows={3}
              defaultValue={existing?.questionConditions ? JSON.stringify(existing.questionConditions, null, 2) : ""}
              aria-invalid={errors.questionConditions ? true : undefined}
              className={`font-mono text-xs ${errors.questionConditions ? "border-destructive" : ""}`}
            />
            {errors.questionConditions && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive">{errors.questionConditions}</pre>
            )}
          </div>

          <div>
            <label htmlFor="priority" className="mb-1 block text-sm font-medium">Priority (higher = surfaces first)</label>
            <Input
              id="priority"
              name="priority"
              type="number"
              defaultValue={String(existing?.priority ?? 1)}
              aria-invalid={errors.priority ? true : undefined}
              className={errors.priority ? "border-destructive" : undefined}
            />
            {errors.priority && <p className="mt-1 text-xs text-destructive">{errors.priority}</p>}
          </div>

          <FormOnCheckbox
            name="isActive"
            id="rule-is-active"
            defaultChecked={existing?.isActive !== false}
            disabled={pending}
            label="Active (engine evaluates this rule)"
          />

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
