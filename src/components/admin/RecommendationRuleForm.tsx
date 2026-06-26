"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recommendationRuleInputSchema,
  type RecommendationCondition,
  type RecommendationRuleInput,
} from "@/lib/admin/recommendation-rule-schemas";
import {
  parseStoredPillarThresholds,
  parseStoredTriggerConditions,
  pillarThresholdRowsToRecord,
  type PillarThresholdRow,
  type RulePickerQuestion,
} from "@/lib/admin/recommendation-rule-ui";
import {
  createRecommendationRule,
  updateRecommendationRule,
} from "@/lib/actions/admin-recommendation-actions";
import { FormOnCheckbox } from "@/components/admin/form-submission-checkbox";
import { PillarThresholdsBuilder } from "@/components/admin/PillarThresholdsBuilder";
import { TriggerConditionsBuilder } from "@/components/admin/TriggerConditionsBuilder";
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
  /** Assessment questions for answer / missing-control conditions. */
  questionOptions: RulePickerQuestion[];
}

/**
 * C1 (BRD §4.4): admin form for RecommendationRule create + edit.
 *
 * Trigger conditions and pillar thresholds are edited with guided controls
 * instead of raw JSON. Zod validation on submit surfaces friendly errors.
 */
export function RecommendationRuleForm({
  existing,
  serviceOptions,
  questionOptions,
}: RuleFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [serviceRecommendationId, setServiceRecommendationId] = useState(
    existing?.serviceRecommendationId ?? ""
  );
  const [triggerConditions, setTriggerConditions] = useState<RecommendationCondition[]>(() =>
    parseStoredTriggerConditions(existing?.triggerConditions),
  );
  const [pillarThresholdRows, setPillarThresholdRows] = useState<PillarThresholdRow[]>(() =>
    parseStoredPillarThresholds(existing?.pillarThresholds),
  );

  const isEdit = !!existing;

  function onSubmit(formData: FormData) {
    setErrors({});
    setTopError(null);

    const raw = {
      serviceRecommendationId: String(formData.get("serviceRecommendationId") ?? ""),
      ruleName: String(formData.get("ruleName") ?? ""),
      description: (formData.get("description") || null) as string | null,
      triggerConditions,
      pillarThresholds: pillarThresholdRowsToRecord(pillarThresholdRows),
      questionConditions: existing?.questionConditions ?? null,
      priority: Number(formData.get("priority") ?? 0),
      isActive: formData.get("isActive") === "on",
    };

    const parsed = recommendationRuleInputSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
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
        <form action={onSubmit} className="space-y-6">
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

          <TriggerConditionsBuilder
            value={triggerConditions}
            onChange={setTriggerConditions}
            questions={questionOptions}
            disabled={pending}
            error={errors.triggerConditions ?? null}
          />

          <PillarThresholdsBuilder
            value={pillarThresholdRows}
            onChange={setPillarThresholdRows}
            disabled={pending}
            error={errors.pillarThresholds ?? null}
          />

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
