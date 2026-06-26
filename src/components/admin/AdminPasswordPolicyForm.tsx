"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildPasswordRequirementsMessage, type PasswordPolicy } from "@/lib/auth/password-policy";
import { updatePasswordPolicy } from "@/lib/admin/platform-settings-actions";

type Props = {
  initialPolicy: PasswordPolicy;
};

type RuleToggleProps = {
  id: string;
  label: string;
import type { FieldHelpKey } from "@/lib/field-help/content";
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function RuleToggle({ id, label, helpKey, checked, onCheckedChange }: RuleToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card/40 p-4 transition-colors hover:bg-muted/30"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <span className="flex items-center gap-1 text-sm font-medium leading-snug">
        {label}
        <FieldHelp helpKey={helpKey} triggerLabel={label} />
      </span>
    </label>
  );
}

export function AdminPasswordPolicyForm({ initialPolicy }: Props) {
  const [minLength, setMinLength] = useState(String(initialPolicy.minLength));
  const [requireUppercase, setRequireUppercase] = useState(
    initialPolicy.requireUppercase
  );
  const [requireNumber, setRequireNumber] = useState(initialPolicy.requireNumber);
  const [requireSpecialCharacter, setRequireSpecialCharacter] = useState(
    initialPolicy.requireSpecialCharacter
  );
  const [complianceNotice, setComplianceNotice] = useState(
    initialPolicy.complianceNotice ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsedLength = Number.parseInt(minLength, 10);
    if (!Number.isFinite(parsedLength) || parsedLength < 8 || parsedLength > 128) {
      toast.error("Minimum length must be between 8 and 128");
      return;
    }

    setSaving(true);
    try {
      const result = await updatePasswordPolicy({
        minLength: parsedLength,
        requireUppercase,
        requireNumber,
        requireSpecialCharacter,
        complianceNotice: complianceNotice.trim() || null,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to update password policy");
        return;
      }

      const affected = result.affectedUsers ?? 0;
      toast.success(
        affected > 0
          ? `Password policy updated (revision ${result.revision}). ${affected} staff account(s) must update their password on next sign-in.`
          : `Password policy updated (revision ${result.revision}).`
      );
    } finally {
      setSaving(false);
    }
  }

  const previewPolicy: PasswordPolicy = {
    minLength: Number.parseInt(minLength, 10) || initialPolicy.minLength,
    requireUppercase,
    requireNumber,
    requireSpecialCharacter,
    revision: initialPolicy.revision,
    complianceNotice: complianceNotice.trim() || null,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border bg-muted/20 p-4 sm:p-5">
        <div className="space-y-2 max-w-xs">
          <LabelWithHelp htmlFor="password-min-length" helpKey="password-min-length">
            Minimum length
          </LabelWithHelp>
          <Input
            id="password-min-length"
            type="number"
            min={8}
            max={128}
            value={minLength}
            onChange={(e) => setMinLength(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Between 8 and 128 characters.</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Character requirements</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <RuleToggle
              id="password-uppercase"
              label="Require uppercase letter"
              helpKey="password-uppercase"
              checked={requireUppercase}
              onCheckedChange={setRequireUppercase}
            />
            <RuleToggle
              id="password-number"
              label="Require number"
              helpKey="password-number"
              checked={requireNumber}
              onCheckedChange={setRequireNumber}
            />
            <RuleToggle
              id="password-special"
              label="Require special character"
              helpKey="password-special"
              checked={requireSpecialCharacter}
              onCheckedChange={setRequireSpecialCharacter}
            />
          </div>
        </div>

        <div className="rounded-md border border-dashed bg-background/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <p className="mt-1 text-sm text-foreground">
            {buildPasswordRequirementsMessage(previewPolicy)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <LabelWithHelp htmlFor="password-compliance-notice" helpKey="password-compliance-notice">
          Compliance notice (shown to users who must update)
        </LabelWithHelp>
        <Textarea
          id="password-compliance-notice"
          value={complianceNotice}
          onChange={(e) => setComplianceNotice(e.target.value)}
          rows={4}
          placeholder="Example: We updated password requirements. Please choose a new password that meets the rules below."
        />
        <p className="text-sm text-muted-foreground">
          Saving rule changes bumps the policy revision and flags all advisor/admin
          accounts to update their password on next sign-in.
        </p>
      </div>

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save password policy"}
      </Button>
    </div>
  );
}
