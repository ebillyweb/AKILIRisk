"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Lock, Save } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import { updateEnterpriseAdvisorMemberVisibilityAction } from "@/lib/actions/enterprise-visibility-actions";
import { updateHouseholdProfilesPolicy } from "@/lib/actions/household-profiles-policy-actions";
import { FieldHelp } from "@/components/ui/field-help";
import type { EnterpriseAdvisorMemberVisibility } from "@/lib/enterprise/advisor-member-visibility";
import type { EnterpriseClientDataPolicy } from "@/lib/enterprise/enterprise-client-data-policy";
import {
  formatVisibilityLockBadge,
  getVisibilityOptionTierState,
  isVisibilityOptionAtModuleTier,
} from "@/lib/enterprise/advisor-member-visibility-tier";
import type { EnterpriseMemberBrandingPolicy } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import { getBrandingPolicyOptionTierState } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import { ENTERPRISE_CLIENT_DATA_POLICY_COPY } from "@/lib/advisor/pii-policy";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type VisibilityOption = {
  key: keyof EnterpriseAdvisorMemberVisibility;
  label: string;
  description: string;
};

type VisibilityOptionGroup = {
  id: string;
  title: string;
  description: string;
  options: VisibilityOption[];
};

const VISIBILITY_OPTION_GROUPS: VisibilityOptionGroup[] = [
  {
    id: "clients",
    title: "Client Management",
    description: "Prospect intake and client onboarding for team members.",
    options: [
      {
        key: "assessmentLeads",
        label: "Assessment leads",
        description:
          "Inbound prospect assignments from the AKILI team.",
      },
      {
        key: "skipIntake",
        label: "Skip intake",
        description:
          "Skip the governance intake step when inviting clients or managing the pipeline.",
      },
      {
        key: "skipPostIntakeReview",
        label: "Skip post-intake review",
        description:
          "After intake (self-service or live sessions), advance to assessment using firm or advisor default risk domains without the review step.",
      },
      {
        key: "documentRequirements",
        label: "Document requirements",
        description:
          "Hide document request and tracking in the advisor workspace and the Documents link in the client portal.",
      },
      {
        key: "sharedClientVisibility",
        label: "Shared client visibility",
        description:
          "Let team members see and work with every client in the firm, not just the ones assigned to them. When off, members see only their own assignments.",
      },
    ],
  },
  {
    id: "portfolio",
    title: "Portfolio Analytics",
    description: "Firm-wide risk insights and monitoring.",
    options: [
      {
        key: "portfolio",
        label: "Portfolio & risk insights",
        description:
          "Risk analytics, intelligence, reports, recommendations, and signals.",
      },
    ],
  },
  {
    id: "assessment-lifecycle",
    title: "Assessment lifecycle",
    description: "Post-assessment implementation and ongoing review.",
    options: [
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
        key: "actionPlan",
        label: "Action plan",
        description:
          "Show the Strategic Action Plan journey step and client portal page for your firm.",
      },
    ],
  },
  {
    id: "account",
    title: "Team Configuration",
    description: "Individual practice settings in the sidebar footer.",
    options: [
      {
        key: "methodology",
        label: "Your methodology",
        description: "Allows team to manage own methodology and question-bank customization.",
      },
    ],
  },
  {
    id: "workspace-experience",
    title: "Workspace experience",
    description: "How the advisor hub looks and behaves for team members.",
    options: [
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
    ],
  },
];

const VISIBILITY_OPTIONS = VISIBILITY_OPTION_GROUPS.flatMap((group) => group.options);

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
  initialClientDataPolicy: EnterpriseClientDataPolicy;
  initialHouseholdProfilesEnabled: boolean;
  moduleTier: SubscriptionTier;
  platformFlags: AdvisorPlatformFeatureFlags;
};

export function EnterpriseAdvisorVisibilityForm({
  initialVisibility,
  initialBrandingPolicy,
  initialClientDataPolicy,
  initialHouseholdProfilesEnabled,
  moduleTier,
  platformFlags,
}: EnterpriseAdvisorVisibilityFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [visibility, setVisibility] = useState(initialVisibility);
  const [brandingPolicy, setBrandingPolicy] = useState(initialBrandingPolicy);
  const [clientDataPolicy, setClientDataPolicy] = useState(initialClientDataPolicy);
  const [householdProfilesEnabled, setHouseholdProfilesEnabled] = useState(
    initialHouseholdProfilesEnabled,
  );
  const [saving, setSaving] = useState(false);

  const clientDataCopy = ENTERPRISE_CLIENT_DATA_POLICY_COPY;

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

  useEffect(() => {
    setClientDataPolicy(initialClientDataPolicy);
  }, [initialClientDataPolicy]);

  useEffect(() => {
    setHouseholdProfilesEnabled(initialHouseholdProfilesEnabled);
  }, [initialHouseholdProfilesEnabled]);

  const visibilityDirty = VISIBILITY_OPTIONS.some(
    ({ key }) => visibility[key] !== initialVisibility[key],
  );
  const brandingDirty = BRANDING_POLICY_OPTIONS.some(
    ({ key }) => brandingPolicy[key] !== initialBrandingPolicy[key],
  );
  const clientDataDirty =
    clientDataPolicy.pseudonymousLabelingDefault !==
      initialClientDataPolicy.pseudonymousLabelingDefault ||
    clientDataPolicy.collectClientLegalNameDefault !==
      initialClientDataPolicy.collectClientLegalNameDefault ||
    clientDataPolicy.policyLocked !== initialClientDataPolicy.policyLocked;
  const householdProfilesDirty =
    householdProfilesEnabled !== initialHouseholdProfilesEnabled;
  const isDirty =
    visibilityDirty || brandingDirty || clientDataDirty || householdProfilesDirty;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (visibilityDirty || brandingDirty || clientDataDirty) {
        const result = await updateEnterpriseAdvisorMemberVisibilityAction({
          visibility,
          brandingPolicy,
          clientDataPolicy,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
      }

      if (householdProfilesDirty) {
        const result = await updateHouseholdProfilesPolicy({
          householdProfilesEnabled,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      }

      toast.success("Team settings saved.");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to save team settings.");
    } finally {
      setSaving(false);
    }
  };

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

  const renderVisibilityCheckbox = ({ key, label, description }: VisibilityOption) => {
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
                {formatVisibilityLockBadge(tierState)}
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
  };

  const renderHouseholdProfilesCheckbox = () => (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <Checkbox
        id="household-profiles-enabled"
        checked={householdProfilesEnabled}
        disabled={saving}
        onCheckedChange={(next) => setHouseholdProfilesEnabled(next === true)}
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Label
              htmlFor="household-profiles-enabled"
              className="text-sm font-medium leading-none"
            >
              Household profiles
            </Label>
            <FieldHelp
              helpKey="household-profiles-enabled"
              triggerLabel="Household profiles"
            />
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Firm-wide
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Let clients document household members and personalize assessments from
          composition and governance roles.
        </p>
        <p className="text-xs text-foreground/80">
          When off, clients will not see Profiles &amp; Roles, assessments use
          generic question text, and your portal omits household composition
          sections. Existing member data is kept and restores if you turn this back on.
        </p>
      </div>
    </div>
  );

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

      <div className="space-y-8">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">Workspace visibility</h3>
          <p className="text-sm text-muted-foreground">
            Choose which sidebar areas team members can access. Settings are grouped to match the
            advisor hub navigation.
          </p>
        </div>

        {VISIBILITY_OPTION_GROUPS.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-foreground">{group.title}</h4>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>
            <div className="space-y-3">
              {group.options.map((option) => renderVisibilityCheckbox(option))}
              {group.id === "clients" ? renderHouseholdProfilesCheckbox() : null}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">
            {clientDataCopy.sectionTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {clientDataCopy.sectionDescription}
          </p>
        </div>

        <RadioGroup
          value={
            clientDataPolicy.pseudonymousLabelingDefault ? "client-id" : "email"
          }
          onValueChange={(value) =>
            setClientDataPolicy((current) => ({
              ...current,
              pseudonymousLabelingDefault: value === "client-id",
            }))
          }
          className="gap-3"
          disabled={saving}
        >
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <RadioGroupItem value="email" id="firm-label-email" className="mt-0.5" />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="firm-label-email" className="text-sm font-medium">
                {clientDataCopy.workspaceLabeling.email.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {clientDataCopy.workspaceLabeling.email.description}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <RadioGroupItem
              value="client-id"
              id="firm-label-client-id"
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="firm-label-client-id" className="text-sm font-medium">
                {clientDataCopy.workspaceLabeling.clientId.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {clientDataCopy.workspaceLabeling.clientId.description}
              </p>
            </div>
          </div>
        </RadioGroup>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="firm-collect-legal-name"
              checked={clientDataPolicy.collectClientLegalNameDefault}
              disabled={saving}
              onCheckedChange={(next) =>
                setClientDataPolicy((current) => ({
                  ...current,
                  collectClientLegalNameDefault: next === true,
                }))
              }
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <Label htmlFor="firm-collect-legal-name" className="text-sm font-medium">
                {clientDataCopy.collectLegalName.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {clientDataCopy.collectLegalName.description}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="firm-lock-client-data-policy"
              checked={clientDataPolicy.policyLocked}
              disabled={saving}
              onCheckedChange={(next) =>
                setClientDataPolicy((current) => ({
                  ...current,
                  policyLocked: next === true,
                }))
              }
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <Label
                htmlFor="firm-lock-client-data-policy"
                className="text-sm font-medium"
              >
                {clientDataCopy.lock.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {clientDataCopy.lock.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">Client-facing branding</h3>
          <p className="text-sm text-muted-foreground">
            Control how team members present themselves to assigned clients.
          </p>
        </div>
        <div className="space-y-3">
          {BRANDING_POLICY_OPTIONS.map((option) =>
            renderPolicyCheckbox(option, brandingPolicy, setBrandingPolicy),
          )}
        </div>
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
            Save Roles & Permissions settings
          </>
        )}
      </Button>
    </div>
  );
}
