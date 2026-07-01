"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Lock, Save } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import { updateEnterpriseAdvisorMemberVisibilityAction } from "@/lib/actions/enterprise-visibility-actions";
import type { EnterpriseAdvisorMemberVisibility } from "@/lib/enterprise/advisor-member-visibility";
import {
  getVisibilityOptionTierState,
  isVisibilityOptionAtModuleTier,
} from "@/lib/enterprise/advisor-member-visibility-tier";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type VisibilityOption = {
  key: keyof EnterpriseAdvisorMemberVisibility;
  label: string;
  description: string;
};

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    key: "portfolio",
    label: "Portfolio",
    description:
      "Risk analytics, intelligence, reports, recommendations, and signals.",
  },
  {
    key: "methodology",
    label: "Your methodology",
    description: "Personal methodology settings in the account footer.",
  },
  {
    key: "engagements",
    label: "Engagement Tracker",
    description: "Accepted recommendations and implementation progress.",
  },
  {
    key: "reassessment",
    label: "Reassessment workflow",
    description: "Scheduled reassessments and the rescoring queue.",
  },
  {
    key: "productTours",
    label: "Guided product tours",
    description: "Auto-start walkthroughs on first visit to workspace areas.",
  },
];

type EnterpriseAdvisorVisibilityFormProps = {
  initialVisibility: EnterpriseAdvisorMemberVisibility;
  moduleTier: SubscriptionTier;
  platformFlags: AdvisorPlatformFeatureFlags;
};

export function EnterpriseAdvisorVisibilityForm({
  initialVisibility,
  moduleTier,
  platformFlags,
}: EnterpriseAdvisorVisibilityFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState(initialVisibility);
  const [saving, setSaving] = useState(false);

  const moduleTierLabel =
    TIER_DISPLAY_NAME[moduleTier as keyof typeof TIER_DISPLAY_NAME] ?? moduleTier;

  const optionTierStates = useMemo(
    () =>
      Object.fromEntries(
        VISIBILITY_OPTIONS.map((option) => [
          option.key,
          getVisibilityOptionTierState(option.key, moduleTier, platformFlags),
        ]),
      ) as Record<
        keyof EnterpriseAdvisorMemberVisibility,
        ReturnType<typeof getVisibilityOptionTierState>
      >,
    [moduleTier, platformFlags],
  );

  useEffect(() => {
    setValues(initialVisibility);
  }, [initialVisibility]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateEnterpriseAdvisorMemberVisibilityAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Advisor visibility settings saved.");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to save advisor visibility settings.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = VISIBILITY_OPTIONS.some(({ key }) => values[key] !== initialVisibility[key]);

  return (
    <div className="space-y-4" data-tour="config-advisor-visibility">
      <Card className="border-muted bg-muted/40">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Control what <span className="font-medium text-foreground">team members</span> see
            when they sign in. Firm owners and administrators always retain full access within
            your module tier and platform limits.
          </p>
          <Badge variant="secondary" className="w-fit shrink-0">
            Firm plan: {moduleTierLabel}
          </Badge>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {VISIBILITY_OPTIONS.map(({ key, label, description }) => {
          const tierState = optionTierStates[key];
          const tierLocked = !tierState.available;
          const checked = tierLocked ? false : values[key];

          return (
            <div
              key={key}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                tierLocked && "border-dashed bg-muted/30 opacity-90",
              )}
            >
              <Checkbox
                id={`advisor-visibility-${key}`}
                checked={checked}
                disabled={saving || tierLocked}
                onCheckedChange={(next) => {
                  if (tierLocked) return;
                  setValues((current) => ({
                    ...current,
                    [key]: next === true,
                  }));
                }}
              />
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Label
                    htmlFor={`advisor-visibility-${key}`}
                    className={cn(
                      "text-sm font-medium leading-none",
                      tierLocked && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </Label>
                  {tierLocked ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Lock className="size-3" aria-hidden />
                      Requires {tierState.requiredTierLabel}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      On your plan
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p
                  className={cn(
                    "text-xs",
                    tierLocked ? "text-muted-foreground" : "text-foreground/80",
                  )}
                >
                  {tierState.includedSummary}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" onClick={handleSave} disabled={saving || !isDirty}>
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save visibility settings
          </>
        )}
      </Button>
    </div>
  );
}
