"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import {
  setClientIntakeWaiver,
  updateClientWaiverAssessmentScope,
} from "@/lib/actions/advisor-intake-waiver-actions";
import { AssessmentDomainsSelector } from "@/components/advisor/AssessmentDomainsSelector";
import { EmphasisAreasSelector } from "@/components/advisor/EmphasisAreasSelector";
import {
  assessmentDomainLabel,
  resolveDefaultAssessmentDomainSelection,
} from "@/lib/advisor/assessment-domain-option";
import type { AdvisorAssessmentDomainPickerData } from "@/lib/advisor/assessment-domain-option";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type IntakeWaiverScopePanelProps = {
  clientId: string;
  assignmentActive: boolean;
  intakeWaived: boolean;
  intakeWaivedAt: Date | null;
  includedPillars: string[];
  focusAreas: string[];
  assessmentDomainPicker: AdvisorAssessmentDomainPickerData;
  /** When true, show the waiver + scope form (no intake submitted). */
  showWaiverAction: boolean;
  /** When true, waiver on/off cannot be changed (assessment already started). */
  waiverLocked?: boolean;
};

export function IntakeWaiverScopePanel({
  clientId,
  assignmentActive,
  intakeWaived,
  intakeWaivedAt,
  includedPillars,
  focusAreas,
  assessmentDomainPicker,
  showWaiverAction,
  waiverLocked = false,
}: IntakeWaiverScopePanelProps) {
  const assessmentDomains = assessmentDomainPicker.domains;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingScope, setEditingScope] = useState(false);
  const [showWaiverForm, setShowWaiverForm] = useState(false);

  const availableDomainIds = assessmentDomains.map((d) => d.id);
  const defaultSelection = resolveDefaultAssessmentDomainSelection({
    availableDomainIds,
    existingIncluded: includedPillars,
  });

  const [selectedDomains, setSelectedDomains] = useState<string[]>(defaultSelection);
  const [selectedEmphasis, setSelectedEmphasis] = useState<string[]>(
    focusAreas.length > 0 && focusAreas.length < includedPillars.length
      ? focusAreas
      : [],
  );

  const scopeSet = includedPillars.length > 0;
  const domainsValid = selectedDomains.length >= 1;

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setEditingScope(false);
        setShowWaiverForm(false);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  if (intakeWaived) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="secondary">Intake waived</Badge>
            {intakeWaivedAt ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Waived {formatDistanceToNow(new Date(intakeWaivedAt), { addSuffix: true })}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !assignmentActive || waiverLocked}
            onClick={() =>
              runAction(() => setClientIntakeWaiver(clientId, false))
            }
          >
            Require intake again
          </Button>
        </div>
        {waiverLocked ? (
          <p className="text-sm text-muted-foreground">
            Assessment is already in progress, so intake waiver cannot be reversed.
          </p>
        ) : null}

        {!scopeSet && !editingScope ? (
          <Alert>
            <AlertDescription>
              Select assessment domains to unlock the client&apos;s assessment. Until
              then, assessment stays locked.
            </AlertDescription>
          </Alert>
        ) : null}

        {scopeSet && !editingScope ? (
          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-4">
            <p className="text-sm font-medium">Assessment domains</p>
            <div className="flex flex-wrap gap-2">
              {includedPillars.map((id) => (
                <Badge key={id} variant="outline">
                  {assessmentDomainLabel(assessmentDomains, id)}
                </Badge>
              ))}
            </div>
            {focusAreas.length > 0 && focusAreas.length < includedPillars.length ? (
              <p className="text-xs text-muted-foreground">
                Scoring emphasis:{" "}
                {focusAreas
                  .map((id) => assessmentDomainLabel(assessmentDomains, id))
                  .join(", ")}
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || !assignmentActive}
              onClick={() => {
                setSelectedDomains(includedPillars);
                setSelectedEmphasis(
                  focusAreas.length > 0 && focusAreas.length < includedPillars.length
                    ? focusAreas
                    : [],
                );
                setEditingScope(true);
              }}
            >
              Edit domains
            </Button>
          </div>
        ) : null}

        {(editingScope || !scopeSet) && (
          <div className="space-y-4 rounded-lg border border-border/80 p-4">
            <AssessmentDomainsSelector
              domains={assessmentDomains}
              selectedDomains={selectedDomains}
              onChange={setSelectedDomains}
              disabled={pending || !assignmentActive}
              platformTotal={assessmentDomainPicker.platformTotal}
              inactiveDomains={assessmentDomainPicker.inactiveDomains}
            />
            <EmphasisAreasSelector
              domains={assessmentDomains}
              includedDomains={selectedDomains}
              selectedEmphasis={selectedEmphasis}
              onChange={setSelectedEmphasis}
              disabled={pending || !assignmentActive}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || !assignmentActive || !domainsValid}
                onClick={() =>
                  runAction(() =>
                    updateClientWaiverAssessmentScope(clientId, {
                      includedPillars: selectedDomains,
                      focusAreas:
                        selectedEmphasis.length > 0 ? selectedEmphasis : undefined,
                    }),
                  )
                }
              >
                {scopeSet ? "Save domains" : "Unlock assessment"}
              </Button>
              {scopeSet ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setEditingScope(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (!showWaiverAction) {
    return null;
  }

  if (waiverLocked) {
    return (
      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        Assessment is already in progress. Intake can no longer be waived for this
        household.
      </p>
    );
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      {!showWaiverForm ? (
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !assignmentActive}
          onClick={() => {
            setSelectedDomains(defaultSelection);
            setSelectedEmphasis([]);
            setShowWaiverForm(true);
          }}
        >
          Allow assessment without intake
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border border-border/80 p-4">
          <p className="text-sm text-muted-foreground">
            Choose which assessment domains to include. The client cannot start
            until you confirm.
          </p>
          <AssessmentDomainsSelector
            domains={assessmentDomains}
            selectedDomains={selectedDomains}
            onChange={setSelectedDomains}
            disabled={pending || !assignmentActive}
            platformTotal={assessmentDomainPicker.platformTotal}
            inactiveDomains={assessmentDomainPicker.inactiveDomains}
          />
          <EmphasisAreasSelector
            domains={assessmentDomains}
            includedDomains={selectedDomains}
            selectedEmphasis={selectedEmphasis}
            onChange={setSelectedEmphasis}
            disabled={pending || !assignmentActive}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending || !assignmentActive || !domainsValid}
              onClick={() =>
                runAction(() =>
                  setClientIntakeWaiver(clientId, true, {
                    includedPillars: selectedDomains,
                    focusAreas:
                      selectedEmphasis.length > 0 ? selectedEmphasis : undefined,
                  }),
                )
              }
            >
              Waive intake and unlock
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setShowWaiverForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
