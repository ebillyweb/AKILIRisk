"use client";

/**
 * Option D session 1 commit 1.3 (BRD §5.1 amendment) — advisor-side
 * PII policy form. Five toggles, one per eligible field, plus a Save
 * button. Submits via the `updatePiiPolicy` server action.
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updatePiiPolicy } from "@/lib/actions/pii-policy-actions";
import {
  ELIGIBLE_PII_FIELDS,
  PII_FIELD_LABELS,
  PSEUDONYMOUS_CLIENT_LABELING_NOTE,
  WORKSPACE_CLIENT_LABELING_COPY,
  type EligiblePiiField,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";
import type { EffectiveAdvisorClientDataPolicy } from "@/lib/enterprise/enterprise-client-data-policy";

interface PiiPolicyFormProps {
  initialPolicy: PiiPolicy;
  effectivePolicy: EffectiveAdvisorClientDataPolicy;
  lockedByEnterprise: boolean;
}

export function PiiPolicyForm({
  initialPolicy,
  effectivePolicy,
  lockedByEnterprise,
}: PiiPolicyFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [fields, setFields] = useState<Record<EligiblePiiField, boolean>>(
    () => ({ ...initialPolicy.fields }),
  );
  const [pseudonymousWorkspaceLabeling, setPseudonymousWorkspaceLabeling] =
    useState(initialPolicy.pseudonymousWorkspaceLabeling);
  const [saving, setSaving] = useState(false);

  const displayedLabeling = lockedByEnterprise
    ? effectivePolicy.pseudonymousWorkspaceLabeling
    : pseudonymousWorkspaceLabeling;
  const displayedFields = lockedByEnterprise
    ? effectivePolicy.fields
    : fields;
  const labelingLocked = lockedByEnterprise;
  const legalNameLocked = lockedByEnterprise;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePiiPolicy({
        fields,
        pseudonymousWorkspaceLabeling,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.data.updated === 0) {
        toast("No changes to save.");
      } else {
        toast.success(
          `Saved. ${result.data.updated} setting${
            result.data.updated === 1 ? "" : "s"
          } updated.`,
        );
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save client data policy.");
    } finally {
      setSaving(false);
    }
  };

  const labelingCopy = WORKSPACE_CLIENT_LABELING_COPY;

  return (
    <div className="space-y-4">
      {lockedByEnterprise ? (
        <Card className="border-muted bg-muted/40">
          <CardContent className="pt-6">
            <p className="text-sm leading-6 text-muted-foreground">
              Your firm locks workspace labeling and client legal name collection
              for team members. Firm owners and administrators can change the firm
              default under Firm → Access control.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card data-tour="config-workspace-labeling">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              {labelingCopy.sectionTitle}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {labelingCopy.sectionDescription}
            </p>
          </div>

          <RadioGroup
            value={displayedLabeling ? "client-id" : "email"}
            onValueChange={(value) =>
              setPseudonymousWorkspaceLabeling(value === "client-id")
            }
            className="gap-3"
            disabled={saving || labelingLocked}
          >
            <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
              <RadioGroupItem
                value="email"
                id="workspace-label-email"
                className="mt-0.5"
              />
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="workspace-label-email"
                  className="text-sm font-medium leading-snug"
                >
                  {labelingCopy.email.label}
                </Label>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {labelingCopy.email.description}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
              <RadioGroupItem
                value="client-id"
                id="workspace-label-client-id"
                className="mt-0.5"
              />
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="workspace-label-client-id"
                  className="text-sm font-medium leading-snug"
                >
                  {labelingCopy.clientId.label}
                </Label>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {labelingCopy.clientId.description}
                </p>
              </div>
            </div>
          </RadioGroup>

          {displayedLabeling ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
              {PSEUDONYMOUS_CLIENT_LABELING_NOTE}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-muted bg-muted/40">
        <CardContent className="pt-6">
          <p className="text-sm leading-6 text-muted-foreground">
            This policy is per advisor—firms can mix practices. The optional
            fields below control what new clients are asked for during intake.
            Existing clients who already consented to a field remain visible to
            you regardless of changes here. To revoke visibility for an existing
            client, contact your administrator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-5 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              Optional intake fields
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose which optional details new clients may provide.
            </p>
          </div>
          <ul className="space-y-5">
            {ELIGIBLE_PII_FIELDS.map((field) => {
              const meta = PII_FIELD_LABELS[field];
              const checked = displayedFields[field];
              const fieldLocked = field === "User.name" && legalNameLocked;
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
                    disabled={saving || fieldLocked}
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
