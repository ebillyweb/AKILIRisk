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
import type { EnterpriseMemberBrandingPolicy } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import { getBrandingPolicyOptionTierState } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
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
    label: "Portfolio & risk insights",
    description:
      "Risk analytics, intelligence, reports, recommendations, and signals in the Portfolio workspace.",
  },
  {
    key: "assessmentLeads",
    label: "Assessment leads",
    description:
      "Inbound prospect assignments from the AKILI team in the Clients workspace.",
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
  {
    key: "hideTierLockedNav",
    label: "Hide unavailable plan features",
    description:
      "Remove sidebar links to features above your firm's module tier instead of showing them locked.",
  },
  {
    key: "skipIntake",
    label: "Skip intake",
    description:
      "Allow team members to skip the governance intake step when inviting clients or managing the pipeline.",
  },
];

type BrandingPolicyOption = {
  key: keyof EnterpriseMemberBrandingPolicy;
  label: string;
  description: string;
  requiresPersonalBranding?: boolean;
};

const BRANDING_POLICY_OPTIONS: BrandingPolicyOption[] = [
  {
    key: "personalBranding",
    label: "Personal branding",
    description:
      "Let team members customize logo, colors, and support details for their assigned clients.",
  },
  {
    key: "personalSubdomain",
    label: "Personal subdomain",
    description:
      "Let team members claim a white-label portal URL for invitations and client access.",
    requiresPersonalBranding: true,
  },
];

type EnterpriseAdvisorVisibilityFormProps = {
  initialVisibility: EnterpriseAdvisorMemberVisibility;
  initialBrandingPolicy: EnterpriseMemberBrandingPolicy;
  moduleTier: SubscriptionTier;
  platformFlags: AdvisorPlatformFeatureFlags;
};

export function EnterpriseAdvisorVisibilityForm({
  initialVisibility,
  initialBrandingPolicy,
  moduleTier,
  platformFlags,
}: EnterpriseAdvisorVisibilityFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [visibility, setVisibility] = useState(initialVisibility);
  const [brandingPolicy, setBrandingPolicy] = useState(initialBrandingPolicy);
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

  const brandingTierStates = useMemo(
    () =>
      Object.fromEntries(
        BRANDING_POLICY_OPTIONS.map((option) => [
          option.key,
          getBrandingPolicyOptionTierState(option.key, moduleTier),
        ]),
      ) as Record<
        keyof EnterpriseMemberBrandingPolicy,
        ReturnType<typeof getBrandingPolicyOptionTierState>
      >,
    [moduleTier],
  );

  useEffect(() => {
    setVisibility(initialVisibility);
  }, [initialVisibility]);

  useEffect(() => {
    setBrandingPolicy(initialBrandingPolicy);
  }, [initialBrandingPolicy]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateEnterpriseAdvisorMemberVisibilityAction({
        visibility,
        brandingPolicy,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Team settings saved.");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to save team settings.");
    } finally {
      setSaving(false);
    }
  };

  const visibilityDirty = VISIBILITY_OPTIONS.some(
    ({ key }) => visibility[key] !== initialVisibility[key],
  );
  const brandingDirty = BRANDING_POLICY_OPTIONS.some(
    ({ key }) => brandingPolicy[key] !== initialBrandingPolicy[key],
  );
  const isDirty = visibilityDirty || brandingDirty;

  const renderPolicyCheckbox = (
    option: BrandingPolicyOption,
    values: EnterpriseMemberBrandingPolicy,
    setValues: React.Dispatch<React.SetStateAction<EnterpriseMemberBrandingPolicy>>,
  ) => {
    const tierState = brandingTierStates[option.key];
    const tierLocked = !tierState.available;
    const requiresPersonal =
      option.requiresPersonalBranding && !values.personalBranding;
    const disabled = saving || tierLocked || requiresPersonal;
    const checked = tierLocked || requiresPersonal ? false : values[option.key];

    return (
      <div
        key={option.key}
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          (tierLocked || requiresPersonal) && "border-dashed bg-muted/30 opacity-90",
        )}
      >
        <Checkbox
          id={`branding-policy-${option.key}`}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => {
            if (disabled) return;
            setValues((current) => ({
              ...current,
              [option.key]: next === true,
              ...(option.key === "personalBranding" && next !== true
                ? { personalSubdomain: false }
                : {}),
            }));
          }}
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              htmlFor={`branding-policy-${option.key}`}
              className={cn(
                "text-sm font-medium leading-none",
                disabled && "text-muted-foreground",
              )}
            >
              {option.label}
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
          <p className="text-sm text-muted-foreground">{option.description}</p>
          <p
            className={cn(
              "text-xs",
              tierLocked || requiresPersonal
                ? "text-muted-foreground"
                : "text-foreground/80",
            )}
          >
            {requiresPersonal
              ? "Enable personal branding first."
              : tierState.includedSummary}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-tour="config-advisor-visibility">
      <Card className="border-muted bg-muted/40">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Control what <span className="font-medium text-foreground">team members</span> see
            and how they present themselves to assigned clients. Firm owners and administrators
            always retain full access within your module tier.
          </p>
          <Badge variant="secondary" className="w-fit shrink-0">
            Firm plan: {moduleTierLabel}
          </Badge>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Workspace visibility</h3>
        {VISIBILITY_OPTIONS.map(({ key, label, description }) => {
          const tierState = optionTierStates[key];
          const tierLocked = !tierState.available;
          const checked = tierLocked ? false : visibility[key];

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
                  setVisibility((current) => ({
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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Client-facing branding</h3>
        {BRANDING_POLICY_OPTIONS.map((option) =>
          renderPolicyCheckbox(option, brandingPolicy, setBrandingPolicy),
        )}
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
            Save team settings
          </>
        )}
      </Button>
    </div>
  );
}
