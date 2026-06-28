"use server";

import { revalidatePath } from "next/cache";
import { AdvisorQuestionSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { advisorHubActionErrorMessage, requireAdvisorRole } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import {
  canDeleteAdvisorQuestion,
  DEFAULT_MATURITY_SCORE_MAP,
  deleteAdvisorQuestionError,
  nextDisplayOrder,
} from "@/lib/methodology/advisor-question-policy";
import { syncEnterpriseMethodologyToMembers } from "@/lib/methodology/clone-enterprise-methodology";

function revalidateEnterpriseMethodologyPaths(pillarSlug?: string) {
  revalidatePath("/advisor/enterprise/methodology");
  revalidatePath("/advisor/enterprise/methodology/pillars");
  revalidatePath("/advisor/enterprise/methodology/intake");
  if (pillarSlug) {
    revalidatePath(`/advisor/enterprise/methodology/questions/${pillarSlug}`);
    revalidatePath(`/advisor/enterprise/methodology/narratives/${pillarSlug}`);
  }
}

async function syncAfterEnterpriseMethodologyChange(enterpriseId: string, pillarSlug?: string) {
  await syncEnterpriseMethodologyToMembers(enterpriseId);
  revalidateEnterpriseMethodologyPaths(pillarSlug);
}

export async function updateEnterprisePillarOverride(
  pillarSlug: string,
  data: {
    isActive?: boolean;
    displayName?: string | null;
    weight?: number;
    threshold?: { lowMin: number; mediumMin: number; highMin: number };
    emphasisMultiplier?: number;
    displayOrder?: number;
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

    await prisma.enterprisePillarOverride.upsert({
      where: {
        enterpriseId_pillarId: {
          enterpriseId: team.enterpriseId,
          pillarId: pillar.id,
        },
      },
      create: {
        enterpriseId: team.enterpriseId,
        pillarId: pillar.id,
        threshold: (data.threshold ?? DEFAULT_RISK_THRESHOLDS) as unknown as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
        displayName: data.displayName ?? null,
        weight: data.weight ?? 10,
        emphasisMultiplier: data.emphasisMultiplier ?? 1.5,
        displayOrder: data.displayOrder ?? pillar.defaultOrder,
      },
      update: {
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.threshold !== undefined
          ? { threshold: data.threshold as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.emphasisMultiplier !== undefined
          ? { emphasisMultiplier: data.emphasisMultiplier }
          : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
        version: { increment: 1 },
      },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, slug);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update firm pillar"),
    };
  }
}

export async function updateEnterprisePillarNarrative(
  pillarSlug: string,
  data: {
    allNegative: string[];
    allYes: string[];
    midBand: { critical: string[]; high: string[]; medium: string[]; low: string[] };
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

    await prisma.enterprisePillarNarrative.upsert({
      where: {
        enterpriseId_pillarId: {
          enterpriseId: team.enterpriseId,
          pillarId: pillar.id,
        },
      },
      create: {
        enterpriseId: team.enterpriseId,
        pillarId: pillar.id,
        allNegative: data.allNegative,
        allYes: data.allYes,
        midBand: data.midBand,
      },
      update: {
        allNegative: data.allNegative,
        allYes: data.allYes,
        midBand: data.midBand,
        version: { increment: 1 },
      },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, slug);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update firm narrative"),
    };
  }
}

export async function updateEnterprisePillarQuestion(
  questionId: string,
  data: {
    questionText?: string;
    whyThisMatters?: string | null;
    recommendedActions?: string | null;
    isVisible?: boolean;
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterprisePillarQuestion.findFirst({
      where: { id: questionId, enterpriseId: team.enterpriseId },
      include: { pillar: true },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }

    await prisma.enterprisePillarQuestion.update({
      where: { id: questionId },
      data: {
        ...(data.questionText !== undefined ? { questionText: data.questionText } : {}),
        ...(data.whyThisMatters !== undefined ? { whyThisMatters: data.whyThisMatters } : {}),
        ...(data.recommendedActions !== undefined
          ? { recommendedActions: data.recommendedActions }
          : {}),
        ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
        version: { increment: 1 },
      },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, existing.pillar?.slug);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update firm assessment question"),
    };
  }
}

export async function createEnterprisePillarQuestion(
  pillarSlug: string,
  data: {
    questionText: string;
    whyThisMatters?: string | null;
    recommendedActions?: string | null;
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

    const text = data.questionText.trim();
    if (!text) {
      return { success: false as const, error: "Question text is required" };
    }

    const siblings = await prisma.enterprisePillarQuestion.findMany({
      where: { enterpriseId: team.enterpriseId, pillarId: pillar.id },
      select: { displayOrder: true },
    });

    const row = await prisma.enterprisePillarQuestion.create({
      data: {
        enterpriseId: team.enterpriseId,
        pillarId: pillar.id,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        sectionCode: "CUSTOM",
        displayOrder: nextDisplayOrder(siblings),
        questionText: text,
        answerType: "scored_0_3",
        scoreMap: DEFAULT_MATURITY_SCORE_MAP as unknown as Prisma.InputJsonValue,
        whyThisMatters: data.whyThisMatters ?? null,
        recommendedActions: data.recommendedActions ?? null,
        isVisible: true,
      },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, slug);
    return { success: true as const, questionId: row.id };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add firm assessment question"),
    };
  }
}

export async function deleteEnterprisePillarQuestion(questionId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterprisePillarQuestion.findFirst({
      where: { id: questionId, enterpriseId: team.enterpriseId },
      include: { pillar: true },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }
    if (!canDeleteAdvisorQuestion(existing.sourceKind)) {
      return { success: false as const, error: deleteAdvisorQuestionError() };
    }

    await prisma.advisorPillarQuestion.deleteMany({
      where: { enterpriseSourceId: questionId },
    });
    await prisma.enterprisePillarQuestion.delete({ where: { id: questionId } });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, existing.pillar?.slug);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete firm assessment question"),
    };
  }
}

export async function updateEnterpriseIntakeQuestion(
  questionId: string,
  data: {
    questionText?: string;
    context?: string | null;
    helpText?: string | null;
    isVisible?: boolean;
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterpriseIntakeQuestion.findFirst({
      where: { id: questionId, enterpriseId: team.enterpriseId },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }

    await prisma.enterpriseIntakeQuestion.update({
      where: { id: questionId },
      data: {
        ...(data.questionText !== undefined ? { questionText: data.questionText } : {}),
        ...(data.context !== undefined ? { context: data.context } : {}),
        ...(data.helpText !== undefined ? { helpText: data.helpText } : {}),
        ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
        version: { increment: 1 },
      },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update firm intake question"),
    };
  }
}

export async function createEnterpriseIntakeQuestion(data: {
  questionText: string;
  context?: string | null;
}) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const text = data.questionText.trim();
    if (!text) {
      return { success: false as const, error: "Question text is required" };
    }

    const siblings = await prisma.enterpriseIntakeQuestion.findMany({
      where: { enterpriseId: team.enterpriseId },
      select: { displayOrder: true },
    });
    const order = nextDisplayOrder(siblings);

    await prisma.enterpriseIntakeQuestion.create({
      data: {
        enterpriseId: team.enterpriseId,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        displayOrder: order,
        questionNumber: String(order + 1),
        questionText: text,
        context: data.context ?? null,
        helpText: data.context ?? null,
        answerType: "audio",
        isVisible: true,
      },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add firm intake question"),
    };
  }
}

export async function deleteEnterpriseIntakeQuestion(questionId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterpriseIntakeQuestion.findFirst({
      where: { id: questionId, enterpriseId: team.enterpriseId },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }
    if (!canDeleteAdvisorQuestion(existing.sourceKind)) {
      return { success: false as const, error: deleteAdvisorQuestionError() };
    }

    await prisma.advisorIntakeQuestion.deleteMany({
      where: { enterpriseSourceId: questionId },
    });
    await prisma.enterpriseIntakeQuestion.delete({ where: { id: questionId } });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete firm intake question"),
    };
  }
}
