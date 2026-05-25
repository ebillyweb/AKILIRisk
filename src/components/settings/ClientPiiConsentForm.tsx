"use client";

/**
 * Settings revisit surface for per-field PII consent (US-51 / Epic 5.3).
 * Reuses `recordConsentDecision` so Yes/No changes are audited with the
 * same idempotency rules as /consent/pending.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { recordConsentDecision } from "@/lib/actions/consent-decision-actions";
import {
  ELIGIBLE_PII_FIELDS,
  PII_FIELD_LABELS,
  type EligiblePiiField,
} from "@/lib/advisor/pii-policy";
import type { ClientConsentPreferenceAssignment } from "@/lib/advisor/client-consent-settings";

interface ClientPiiConsentFormProps {
  assignments: ClientConsentPreferenceAssignment[];
}

export function ClientPiiConsentForm({ assignments }: ClientPiiConsentFormProps) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<
    Record<string, Partial<Record<EligiblePiiField, boolean>>>
  >(() => {
    const seed: Record<string, Partial<Record<EligiblePiiField, boolean>>> = {};
    for (const a of assignments) {
      seed[a.assignmentId] = { ...a.currentDecisions };
    }
    return seed;
  });
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null);

  const setDecision = (
    assignmentId: string,
    field: EligiblePiiField,
    value: boolean
  ) => {
    setDecisions((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [field]: value },
    }));
  };

  const handleSave = async (assignmentId: string) => {
    setSavingAssignment(assignmentId);
    try {
      const result = await recordConsentDecision({
        assignmentId,
        decisions: decisions[assignmentId] ?? {},
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Privacy preferences updated.");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save preferences.");
    } finally {
      setSavingAssignment(null);
    }
  };

  if (assignments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {assignments.map((a) => {
        const promptFields = ELIGIBLE_PII_FIELDS.filter(
          (f) => a.advisorPolicy.fields[f]
        );
        if (promptFields.length === 0) return null;

        return (
          <Card key={a.assignmentId}>
            <CardHeader>
              <CardTitle className="text-xl">
                Privacy — {a.firmName || "your advisor"}
              </CardTitle>
              <CardDescription>
                Choose which optional details {a.firmName || "your advisor"}{" "}
                can see. When you decline a field, they see your email or
                pseudonymous labels instead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {promptFields.map((field) => {
                  const meta = PII_FIELD_LABELS[field];
                  const current = decisions[a.assignmentId]?.[field];
                  const idBase = `settings-consent-${a.assignmentId}-${field.replace(
                    /\./g,
                    "-"
                  )}`;
                  return (
                    <li
                      key={field}
                      className="rounded-md border p-4"
                      data-pii-field={field}
                    >
                      <div className="space-y-1">
                        <Label className="text-base font-medium">
                          {meta.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {meta.description}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-6">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={idBase}
                            checked={current === true}
                            onChange={() =>
                              setDecision(a.assignmentId, field, true)
                            }
                          />
                          Yes, allow
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={idBase}
                            checked={current === false}
                            onChange={() =>
                              setDecision(a.assignmentId, field, false)
                            }
                          />
                          No, keep private
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => handleSave(a.assignmentId)}
                  disabled={savingAssignment === a.assignmentId}
                >
                  {savingAssignment === a.assignmentId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
