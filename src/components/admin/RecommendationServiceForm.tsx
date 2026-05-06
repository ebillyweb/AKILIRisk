"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  serviceRecommendationInputSchema,
  TIER_VALUES,
  COMPLEXITY_VALUES,
  IMPLEMENTATION_TYPE_VALUES,
  type ServiceRecommendationInput,
} from "@/lib/admin/recommendation-rule-schemas";
import {
  createServiceRecommendation,
  updateServiceRecommendation,
} from "@/lib/actions/admin-recommendation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceFormProps {
  /** Existing row (edit mode) or null (create mode). */
  existing: (Partial<ServiceRecommendationInput> & { id: string }) | null;
  /** Active categories suggested in the datalist hint. */
  knownCategories: string[];
}

/**
 * C1 (BRD §4.4): admin form for ServiceRecommendation create + edit.
 *
 * Validation runs through `serviceRecommendationInputSchema` on submit;
 * Zod errors map to per-field messages so admins see "Name is required"
 * not a stack trace. Server action errors surface in a banner at the top.
 */
export function RecommendationServiceForm({ existing, knownCategories }: ServiceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const isEdit = !!existing;

  function setField(key: string, value: string) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTopError(null);
    void value;
  }

  function onSubmit(formData: FormData) {
    setErrors({});
    setTopError(null);

    const raw: Partial<ServiceRecommendationInput> = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? ""),
      tier: String(formData.get("tier") ?? "BASELINE") as ServiceRecommendationInput["tier"],
      complexity: (formData.get("complexity") || null) as ServiceRecommendationInput["complexity"],
      implementationType: (formData.get("implementationType") || null) as ServiceRecommendationInput["implementationType"],
      priority: Number(formData.get("priority") ?? 0),
      estimatedCost: (formData.get("estimatedCost") || null) as string | null,
      timeframe: (formData.get("timeframe") || null) as string | null,
      provider: (formData.get("provider") || null) as string | null,
      isActive: formData.get("isActive") === "on",
    };

    const parsed = serviceRecommendationInputSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "_";
        fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateServiceRecommendation({ ...parsed.data, id: existing!.id })
        : await createServiceRecommendation(parsed.data);
      if (result.success) {
        router.push("/admin/recommendations");
        router.refresh();
      } else {
        setTopError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit recommendation" : "New recommendation"}</CardTitle>
      </CardHeader>
      <CardContent>
        {topError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {topError}
          </div>
        )}
        <form action={onSubmit} className="space-y-4">
          <Field label="Name" name="name" defaultValue={existing?.name} error={errors.name} setField={setField} />
          <Field
            label="Description"
            name="description"
            defaultValue={existing?.description}
            error={errors.description}
            setField={setField}
            textarea
            rows={4}
          />
          <Field
            label="Category"
            name="category"
            defaultValue={existing?.category}
            error={errors.category}
            setField={setField}
            list="known-categories"
          />
          <datalist id="known-categories">
            {knownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <SelectField
            label="Tier (BRD §4.4)"
            name="tier"
            options={[...TIER_VALUES]}
            defaultValue={existing?.tier ?? "BASELINE"}
            error={errors.tier}
          />
          <SelectField
            label="Complexity"
            name="complexity"
            options={["", ...COMPLEXITY_VALUES]}
            defaultValue={existing?.complexity ?? ""}
            error={errors.complexity}
            allowEmpty
          />
          <SelectField
            label="Implementation type"
            name="implementationType"
            options={["", ...IMPLEMENTATION_TYPE_VALUES]}
            defaultValue={existing?.implementationType ?? ""}
            error={errors.implementationType}
            allowEmpty
          />
          <Field
            label="Priority"
            name="priority"
            type="number"
            defaultValue={String(existing?.priority ?? 0)}
            error={errors.priority}
            setField={setField}
          />
          <Field label="Estimated cost (e.g. $5,000–$20,000)" name="estimatedCost" defaultValue={existing?.estimatedCost ?? ""} error={errors.estimatedCost} setField={setField} />
          <Field label="Timeframe (e.g. 2–4 months)" name="timeframe" defaultValue={existing?.timeframe ?? ""} error={errors.timeframe} setField={setField} />
          <Field label="Provider" name="provider" defaultValue={existing?.provider ?? ""} error={errors.provider} setField={setField} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={existing?.isActive !== false} />
            Active (visible to the recommendation engine)
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  setField: (k: string, v: string) => void;
  textarea?: boolean;
  rows?: number;
  type?: string;
  list?: string;
}

function Field({ label, name, defaultValue, error, setField, textarea, rows, type, list }: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue ?? ""}
          rows={rows ?? 3}
          onChange={(e) => setField(name, e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${error ? "border-destructive" : "border-input"}`}
        />
      ) : (
        <input
          id={name}
          name={name}
          defaultValue={defaultValue ?? ""}
          type={type ?? "text"}
          list={list}
          onChange={(e) => setField(name, e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${error ? "border-destructive" : "border-input"}`}
        />
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
  error?: string;
  allowEmpty?: boolean;
}

function SelectField({ label, name, options, defaultValue, error, allowEmpty }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? options[0]}
        className={`w-full rounded-md border px-3 py-2 text-sm bg-background ${error ? "border-destructive" : "border-input"}`}
      >
        {options.map((opt) =>
          opt === "" ? (
            allowEmpty ? <option key="_empty" value="">— none —</option> : null
          ) : (
            <option key={opt} value={opt}>{opt}</option>
          )
        )}
      </select>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
