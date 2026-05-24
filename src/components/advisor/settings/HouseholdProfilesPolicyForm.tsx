"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateHouseholdProfilesPolicy } from "@/lib/actions/household-profiles-policy-actions";

interface HouseholdProfilesPolicyFormProps {
  initialEnabled: boolean;
}

export function HouseholdProfilesPolicyForm({
  initialEnabled,
}: HouseholdProfilesPolicyFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateHouseholdProfilesPolicy({
        householdProfilesEnabled: enabled,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        enabled
          ? "Household profiles enabled for your clients."
          : "Household profiles disabled for your clients.",
      );
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to save household profiles setting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-muted bg-muted/40">
        <CardContent className="pt-6">
          <p className="text-sm leading-6 text-muted-foreground">
            When off, clients will not see Profiles &amp; Roles, assessments use
            generic question text, and your portal omits household composition
            sections. Existing member data is kept and restores if you turn this
            back on.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="household-profiles-enabled"
          checked={enabled}
          disabled={saving}
          onCheckedChange={(v) => setEnabled(v === true)}
        />
        <div className="grid gap-1">
          <Label htmlFor="household-profiles-enabled" className="text-sm font-medium leading-none">
            Household profiles
          </Label>
          <p className="text-sm text-muted-foreground">
            Let clients document household members and personalize assessments
            from composition and governance roles.
          </p>
        </motion.div>
      </div>

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save
          </>
        )}
      </Button>
    </div>
  );
}
