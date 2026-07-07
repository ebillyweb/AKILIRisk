"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateEnterpriseModuleTierByAdmin,
  type UpdateEnterpriseModuleTierInput,
} from "@/lib/admin/actions";
import {
  SELF_SERVE_TIERS,
  TIER_CATALOG,
  TIER_DISPLAY_NAME,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";

type AdminEnterpriseSubscriptionPanelProps = {
  enterpriseId: string;
  moduleTier: SelfServeTier;
  billingCycle: "MONTHLY" | "ANNUAL";
};

export function AdminEnterpriseSubscriptionPanel({
  enterpriseId,
  moduleTier: initialModuleTier,
  billingCycle: initialBillingCycle,
}: AdminEnterpriseSubscriptionPanelProps) {
  const router = useRouter();
  const [moduleTier, setModuleTier] = useState<SelfServeTier>(initialModuleTier);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">(
    initialBillingCycle
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSave = async () => {
    setIsSubmitting(true);
    try {
      const payload: UpdateEnterpriseModuleTierInput = {
        enterpriseId,
        moduleTier,
        billingCycle,
      };
      const result = await updateEnterpriseModuleTierByAdmin(payload);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update module tier.");
        return;
      }
      toast.success("Module tier updated.");
      router.refresh();
    } catch {
      toast.error("Failed to update module tier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    moduleTier !== initialModuleTier || billingCycle !== initialBillingCycle;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Module tier controls firm-wide feature entitlements for all team members. Enterprise
        provisioning (seats, caps, payment method) is separate from the subscription package.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-module-tier">Module tier</Label>
          <Select
            value={moduleTier}
            onValueChange={(value) => setModuleTier(value as SelfServeTier)}
          >
            <SelectTrigger id="admin-module-tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELF_SERVE_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {TIER_DISPLAY_NAME[tier]} — {TIER_CATALOG[tier].modules}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-billing-cycle">Billing cycle</Label>
          <Select
            value={billingCycle}
            onValueChange={(value) =>
              setBillingCycle(value as "MONTHLY" | "ANNUAL")
            }
          >
            <SelectTrigger id="admin-billing-cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="ANNUAL">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="button" disabled={isSubmitting || !hasChanges} onClick={onSave}>
        {isSubmitting ? "Saving…" : "Save module tier"}
      </Button>
    </div>
  );
}
