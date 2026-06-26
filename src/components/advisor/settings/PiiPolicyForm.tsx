"use client";

/**
 * Option D session 1 commit 1.3 (BRD §5.1 amendment) — advisor-side
 * PII policy form. Five toggles, one per eligible field, plus a Save
 * button. Submits via the `updatePiiPolicy` server action.
 *
 * Idempotency surfaced to the user: if no toggles changed, the action
 * returns updated=0 and we toast a "no changes" notice instead of
 * "saved." This is mostly cosmetic — the action also short-circuits
 * server-side so there's no DB write either way — but it's clearer
 * UX than a generic "saved" for a no-op submit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";

import { FieldHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updatePiiPolicy } from "@/lib/actions/pii-policy-actions";
import {
  ELIGIBLE_PII_FIELDS,
  PII_FIELD_LABELS,
  type EligiblePiiField,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";

interface PiiPolicyFormProps {
  initialPolicy: PiiPolicy;
}

export function PiiPolicyForm({ initialPolicy }: PiiPolicyFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [fields, setFields] = useState<Record<EligiblePiiField, boolean>>(
    () => ({ ...initialPolicy.fields })
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePiiPolicy({ fields });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.data.updated === 0) {
        toast("No changes to save.");
      } else {
        toast.success(
          `Saved. ${result.data.updated} field${
            result.data.updated === 1 ? "" : "s"
          } updated.`
        );
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save PII policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Per-design section 10 callout copy. */}
      <Card className="border-muted bg-muted/40">
        <CardContent className="pt-6">
          <p className="text-sm leading-6 text-muted-foreground">
            This policy controls what optional PII your future clients are
            asked for during intake. Existing clients who already consented
            to a field remain visible to you regardless of changes here —
            disabling a field hides it for new intakes only. To revoke
            visibility for an existing client, contact your administrator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ul className="space-y-5">
            {ELIGIBLE_PII_FIELDS.map((field) => {
              const meta = PII_FIELD_LABELS[field];
              const checked = fields[field];
              const switchId = `pii-toggle-${field.replace(/\./g, "-")}`;
              return (
                <li
                  key={field}
                  className="flex items-start justify-between gap-4 border-b pb-5 last:border-b-0 last:pb-0"
                  data-pii-field={field}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <Label
                        htmlFor={switchId}
                        className="text-base font-medium"
                      >
                        {meta.label}
                      </Label>
                      <FieldHelp
                        title={meta.label}
                        description={meta.description}
                        triggerLabel={meta.label}
                      />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {meta.description}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {field}
                    </p>
                  </div>
                  <Checkbox
                    id={switchId}
                    checked={checked}
                    onCheckedChange={(v) =>
                      setFields((prev) => ({ ...prev, [field]: v === true }))
                    }
                    disabled={saving}
                  />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save policy
        </Button>
      </div>
    </div>
  );
}
