"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updatePlatformMfaPolicy } from "@/lib/admin/platform-settings-actions";

type Props = {
  initialMfaRequiredForAllRoles: boolean;
};

export function AdminMfaPolicyForm({ initialMfaRequiredForAllRoles }: Props) {
  const [requiredForAll, setRequiredForAll] = useState(
    initialMfaRequiredForAllRoles
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updatePlatformMfaPolicy({
        mfaRequiredForAllRoles: requiredForAll,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to update MFA policy");
        return;
      }
      toast.success("MFA policy updated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="mfa-all-roles"
          checked={requiredForAll}
          onCheckedChange={(value) => setRequiredForAll(value === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="mfa-all-roles">Require MFA for client accounts</Label>
          <p className="text-sm text-muted-foreground">
            Advisor, admin, and super-admin accounts always require MFA. Enable
            this to extend enrollment to client (USER) accounts as well.
          </p>
        </div>
      </div>
      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save MFA policy"}
      </Button>
    </div>
  );
}
