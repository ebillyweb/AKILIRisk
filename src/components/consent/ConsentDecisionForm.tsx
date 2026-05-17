"use client";

/**
 * Option D session 2.2 (BRD §5.1 amendment) — per-assignment consent
 * prompt. Renders one card per pending assignment with a Yes/No
 * radio per eligible field (filtered to the advisor's current
 * piiPolicy). Submitting persists every decision via
 * `recordConsentDecision`; on success the page reloads, the dashboard
 * gate is satisfied, and the client lands on /dashboard.
 *
 * "All No" is allowed — the client can decline every field and
 * proceed. They retain the ability to flip a No → Yes later by
 * filling the field on /settings or /profiles (which uses
 * `recordPiiFieldConsent` from session 2.1).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Check } from "lucide-react";

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
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";

interface PendingAssignmentPrompt {
  assignmentId: string;
  firmName: string | null;
  advisorPolicy: PiiPolicy;
}

interface ConsentDecisionFormProps {
  assignments: PendingAssignmentPrompt[];
}

export function ConsentDecisionForm({ assignments }: ConsentDecisionFormProps) {
  const router = useRouter();
  // State map keyed by assignmentId, then by field.
  const [decisions, setDecisions] = useState<
    Record<string, Partial<Record<EligiblePiiField, boolean>>>
  >(() => {
    const seed: Record<string, Partial<Record<EligiblePiiField, boolean>>> = {};
    for (const a of assignments) seed[a.assignmentId] = {};
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

  const handleSubmit = async (assignmentId: string) => {
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
      toast.success("Preferences saved.");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save preferences.");
    } finally {
      setSavingAssignment(null);
    }
  };

  return (
    <div className="space-y-6">
      {assignments.map((a) => {
        // Filter the eligible-fields list to the ones the advisor is
        // collecting. Fields the advisor's policy disables aren't on
        // the prompt at all.
        const promptFields = ELIGIBLE_PII_FIELDS.filter(
          (f) => a.advisorPolicy.fields[f]
        );
        return (
          <Card key={a.assignmentId} data-assignment-id={a.assignmentId}>
            <CardHeader>
              <CardTitle>
                Welcome to {a.firmName || "your advisor"}
              </CardTitle>
              <CardDescription>
                Before you continue, choose which optional details you&apos;d
                like {a.firmName || "your advisor"} to be able to see. You can
                change any of these later from /settings and /profiles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {promptFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {a.firmName || "Your advisor"} does not collect any optional
                  PII fields. Click <strong>Continue</strong> to proceed to
                  your dashboard.
                </p>
              ) : (
                <ul className="space-y-3">
                  {promptFields.map((field) => {
                    const meta = PII_FIELD_LABELS[field];
                    const current = decisions[a.assignmentId]?.[field];
                    const idBase = `consent-${a.assignmentId}-${field.replace(
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
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
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
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
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
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => handleSubmit(a.assignmentId)}
                  disabled={savingAssignment === a.assignmentId}
                >
                  {savingAssignment === a.assignmentId ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
