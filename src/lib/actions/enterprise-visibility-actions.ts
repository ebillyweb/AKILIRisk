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
import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";

const visibilitySchema = z.object({
  portfolio: z.boolean(),
  methodology: z.boolean(),
  engagements: z.boolean(),
  reassessment: z.boolean(),
  productTours: z.boolean(),
});

export async function updateEnterpriseAdvisorMemberVisibilityAction(
  input: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    const parsed = visibilitySchema.parse(input) satisfies EnterpriseAdvisorMemberVisibility;

    const billingContext = await resolveBillingContext(userId);
    const moduleTier = billingContext?.subscription?.tier ?? "ESSENTIALS";
    const clamped = clampVisibilityToModuleTier(parsed, moduleTier);

    await prisma.advisorEnterprise.update({
      where: { id: team.enterpriseId },
      data: visibilityInputToEnterpriseUpdate(clamped),
    });

    revalidatePath("/advisor/settings/team");
    revalidatePath("/advisor");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid visibility settings" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update visibility settings",
    };
  }
}
