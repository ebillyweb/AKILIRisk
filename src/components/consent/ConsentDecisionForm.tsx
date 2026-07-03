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
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { recordConsentDecision } from "@/lib/actions/consent-decision-actions";
import {
  scopePostAuthPath,
  stripTenantPathPrefix,
} from "@/lib/client/tenant-path-prefix-client";
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
  /** Where to send the client once all consent prompts are satisfied. */
  returnTo?: string;
}

function ConsentChoice({
  selected,
  label,
  hint,
  onSelect,
}: {
  selected: boolean;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/25"
          : "border-border/80 bg-card/60 hover:border-border hover:bg-muted/30"
      )}
    >
      <span className="block font-medium text-foreground">{label}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

export function ConsentDecisionForm({
  assignments,
  returnTo = "/dashboard",
}: ConsentDecisionFormProps) {
  const router = useRouter();
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
      if (assignments.length === 1) {
        router.push(scopePostAuthPath(returnTo));
        return;
      }
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
        const promptFields = ELIGIBLE_PII_FIELDS.filter(
          (f) => a.advisorPolicy.fields[f]
        );
        const firmLabel = a.firmName || "your advisor";

        return (
          <div
            key={a.assignmentId}
            data-assignment-id={a.assignmentId}
            className="space-y-5 rounded-2xl border border-border/80 bg-background/50 p-5 sm:p-6"
          >
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Sharing with {firmLabel}
              </h2>
              <p className="text-sm leading-relaxed text-foreground/75">
                Choose what optional details {firmLabel} may view. You can update
                these later in{" "}
                <Link
                  href={scopePostAuthPath("/settings")}
                  className="font-medium text-primary hover:underline"
                >
                  Settings
                </Link>{" "}
                or{" "}
                <Link
                  href={scopePostAuthPath("/profiles")}
                  className="font-medium text-primary hover:underline"
                >
                  Profiles
                </Link>
                .
              </p>
            </div>

            {promptFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {firmLabel} does not collect any optional personal details. Click
                Continue to proceed to your dashboard.
              </p>
            ) : (
              <ul className="space-y-4">
                {promptFields.map((field) => {
                  const meta = PII_FIELD_LABELS[field];
                  const current = decisions[a.assignmentId]?.[field];

                  return (
                    <li
                      key={field}
                      className="rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5"
                      data-pii-field={field}
                    >
                      <div className="space-y-1">
                        <Label className="text-base font-medium text-foreground">
                          {meta.label}
                        </Label>
                        <p className="text-sm leading-snug text-muted-foreground">
                          {meta.description}
                        </p>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <ConsentChoice
                          selected={current === true}
                          label="Yes, allow"
                          hint="Your advisor can see this detail"
                          onSelect={() => setDecision(a.assignmentId, field, true)}
                        />
                        <ConsentChoice
                          selected={current === false}
                          label="No, keep private"
                          hint="Hidden from your advisor"
                          onSelect={() => setDecision(a.assignmentId, field, false)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-stretch border-t border-border/60 pt-4 sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                onClick={() => handleSubmit(a.assignmentId)}
                disabled={savingAssignment === a.assignmentId}
              >
                {savingAssignment === a.assignmentId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {stripTenantPathPrefix(returnTo) === "/assessment"
                  ? "Continue to assessment"
                  : "Continue to dashboard"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
