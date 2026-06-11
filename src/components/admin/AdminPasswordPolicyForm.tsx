"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildPasswordRequirementsMessage, type PasswordPolicy } from "@/lib/auth/password-policy";
import { updatePasswordPolicy } from "@/lib/admin/platform-settings-actions";

type Props = {
  initialPolicy: PasswordPolicy;
};

export function AdminPasswordPolicyForm({ initialPolicy }: Props) {
  const [minLength, setMinLength] = useState(String(initialPolicy.minLength));
  const [requireUppercase, setRequireUppercase] = useState(
    initialPolicy.requireUppercase
  );
  const [requireNumber, setRequireNumber] = useState(initialPolicy.requireNumber);
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
    revision: initialPolicy.revision,
    complianceNotice: complianceNotice.trim() || null,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="password-min-length">Minimum length</Label>
          <Input
            id="password-min-length"
            type="number"
            min={8}
            max={128}
            value={minLength}
            onChange={(e) => setMinLength(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-3 rounded-lg border p-4 sm:col-span-2">
          <Checkbox
            id="password-uppercase"
            checked={requireUppercase}
            onCheckedChange={(value) => setRequireUppercase(value === true)}
          />
          <Label htmlFor="password-uppercase">Require uppercase letter</Label>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="password-number"
          checked={requireNumber}
          onCheckedChange={(value) => setRequireNumber(value === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="password-number">Require number</Label>
          <p className="text-sm text-muted-foreground">
            Preview: {buildPasswordRequirementsMessage(previewPolicy)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-compliance-notice">
          Compliance notice (shown to users who must update)
        </Label>
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
