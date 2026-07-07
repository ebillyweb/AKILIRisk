"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import {
  visibilityInputToEnterpriseUpdate,
  type EnterpriseAdvisorMemberVisibility,
} from "@/lib/enterprise/advisor-member-visibility";
import { clampVisibilityToModuleTier } from "@/lib/enterprise/advisor-member-visibility-tier";
import {
  brandingPolicyInputToEnterpriseUpdate,
  clampBrandingPolicyToModuleTier,
  type EnterpriseMemberBrandingPolicy,
} from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import {
  clientDataPolicyInputToEnterpriseUpdate,
  type EnterpriseClientDataPolicy,
} from "@/lib/enterprise/enterprise-client-data-policy";
import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";

const visibilitySchema = z.object({
  portfolio: z.boolean(),
  assessmentLeads: z.boolean(),
  methodology: z.boolean(),
  engagements: z.boolean(),
  reassessment: z.boolean(),
  productTours: z.boolean(),
  hideTierLockedNav: z.boolean(),
  skipIntake: z.boolean(),
  skipPostIntakeReview: z.boolean(),
  documentRequirements: z.boolean(),
  actionPlan: z.boolean(),
});

const brandingPolicySchema = z.object({
  personalBranding: z.boolean(),
  personalSubdomain: z.boolean(),
});

const clientDataPolicySchema = z.object({
  pseudonymousLabelingDefault: z.boolean(),
  collectClientLegalNameDefault: z.boolean(),
  policyLocked: z.boolean(),
});

const teamPolicySchema = z.object({
  visibility: visibilitySchema,
  brandingPolicy: brandingPolicySchema,
  clientDataPolicy: clientDataPolicySchema,
});

export async function updateEnterpriseAdvisorMemberVisibilityAction(
  input: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    const parsed = teamPolicySchema.parse(input);
    const visibility = parsed.visibility satisfies EnterpriseAdvisorMemberVisibility;
    const brandingPolicy = parsed.brandingPolicy satisfies EnterpriseMemberBrandingPolicy;
    const clientDataPolicy = parsed.clientDataPolicy satisfies EnterpriseClientDataPolicy;

    const billingContext = await resolveBillingContext(userId);
    const moduleTier = billingContext?.subscription?.tier ?? "ESSENTIALS";
    const clampedVisibility = clampVisibilityToModuleTier(visibility, moduleTier);
    const clampedBranding = clampBrandingPolicyToModuleTier(
      brandingPolicy,
      moduleTier,
    );

    await prisma.advisorEnterprise.update({
      where: { id: team.enterpriseId },
      data: {
        ...visibilityInputToEnterpriseUpdate(clampedVisibility),
        ...brandingPolicyInputToEnterpriseUpdate(clampedBranding),
        ...clientDataPolicyInputToEnterpriseUpdate(clientDataPolicy),
      },
    });

    revalidatePath("/advisor/settings/team");
    revalidatePath("/advisor/settings/access-control");
    revalidatePath("/advisor/settings");
    revalidatePath("/advisor/settings/pii-policy");
    revalidatePath("/advisor");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid team policy settings" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update team settings",
    };
  }
}
