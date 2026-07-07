"use server";

import { revalidatePath } from "next/cache";
import { AdvisorQuestionSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdvisorRole, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { defaultCustomRecommendationConditions } from "@/lib/methodology/advisor-recommendation-starter";
import { parseRecommendationTriggerConditions } from "@/lib/admin/recommendation-rule-schemas";
import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";
import { syncEnterpriseRulesToMembers } from "@/lib/methodology/clone-enterprise-defaults";

function revalidateEnterprisePaths(pillarSlug?: string) {
  revalidatePath("/advisor/enterprise/recommendations");
  if (pillarSlug) {
    revalidatePath(`/advisor/enterprise/recommendations/${pillarSlug}`);
  }
}

export async function updateEnterpriseRecommendationRule(
  ruleId: string,
  data: {
    name?: string;
    priority?: number;
    isActive?: boolean;
    triggerConditions?: RecommendationCondition[];
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterpriseRecommendationRule.findFirst({
      where: { id: ruleId, enterpriseId: team.enterpriseId },
      include: { pillar: true },
    });
    if (!existing) {
      return { success: false as const, error: "Rule not found" };
    }

    let triggerConditionsJson: Prisma.InputJsonValue | undefined;
    if (data.triggerConditions !== undefined) {
      const parsed = parseRecommendationTriggerConditions(data.triggerConditions);
      if (!parsed.success) {
        return { success: false as const, error: parsed.error };
      }
      triggerConditionsJson = parsed.data as unknown as Prisma.InputJsonValue;
    }

    await prisma.enterpriseRecommendationRule.update({
      where: { id: ruleId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(triggerConditionsJson !== undefined
          ? { triggerConditions: triggerConditionsJson }
          : {}),
        version: { increment: 1 },
      },
    });

    // Sync changes down to member advisors
    await syncEnterpriseRulesToMembers(team.enterpriseId);

    revalidateEnterprisePaths(existing.pillar?.slug);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update enterprise rule"),
    };
  }
}

export async function createEnterpriseRecommendationRule(
  pillarSlug: string,
  data: {
    name: string;
    serviceRecommendationId: string;
    priority?: number;
    triggerConditions?: RecommendationCondition[];
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    const slug = normalizePillarSlug(pillarSlug);
    const pillar = await prisma.pillar.findUnique({ where: { slug } });
    if (!pillar) {
      return { success: false as const, error: "Unknown pillar" };
    }

    const name = data.name.trim();
    if (!name) {
      return { success: false as const, error: "Rule name is required" };
    }

    const service = await prisma.serviceRecommendation.findFirst({
      where: { id: data.serviceRecommendationId, isActive: true },
    });
    if (!service) {
      return { success: false as const, error: "Service recommendation not found" };
    }

    const conditionsInput =
      data.triggerConditions ?? defaultCustomRecommendationConditions(slug);
    const parsed = parseRecommendationTriggerConditions(conditionsInput);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error };
    }

    const row = await prisma.enterpriseRecommendationRule.create({
      data: {
        enterpriseId: team.enterpriseId,
        pillarId: pillar.id,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        name,
        triggerConditions: parsed.data as unknown as Prisma.InputJsonValue,
        servicePayload: {
          serviceRecommendationId: service.id,
          serviceId: service.id,
        },
        priority: data.priority ?? 1,
        isActive: true,
      },
    });

    // Sync new rule down to member advisors
    await syncEnterpriseRulesToMembers(team.enterpriseId);

    revalidateEnterprisePaths(slug);
    return { success: true as const, ruleId: row.id };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add enterprise rule"),
    };
  }
}

export async function deleteEnterpriseRecommendationRule(ruleId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterpriseRecommendationRule.findFirst({
      where: { id: ruleId, enterpriseId: team.enterpriseId },
      include: { pillar: true },
    });
    if (!existing) {
      return { success: false as const, error: "Rule not found" };
    }
    if (existing.sourceKind !== AdvisorQuestionSource.CUSTOM) {
      return {
        success: false as const,
        error: "Platform base rules cannot be deleted. Deactivate them instead.",
      };
    }

    // Deactivate advisor clones before deleting the enterprise source
    await prisma.advisorRecommendationRule.updateMany({
      where: { enterpriseSourceId: ruleId },
      data: { isActive: false, enterpriseSourceId: null },
    });

    await prisma.enterpriseRecommendationRule.delete({ where: { id: ruleId } });

    revalidateEnterprisePaths(existing.pillar?.slug);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete enterprise rule"),
    };
  }
}
