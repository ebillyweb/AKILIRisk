"use server";

import { revalidatePath } from "next/cache";
import { AdvisorQuestionSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getAdvisorProfileOrThrow,
  requireAdvisorRole,
  advisorHubActionErrorMessage,
} from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import {
  buildAdvisorAssessmentQuestionWriteData,
  parseAdvisorAssessmentQuestionInput,
} from "@/lib/methodology/advisor-assessment-question-config";
import {
  canDeleteAdvisorQuestion,
  deleteAdvisorQuestionError,
  nextDisplayOrder,
} from "@/lib/methodology/advisor-question-policy";
import { defaultCustomRecommendationConditions } from "@/lib/methodology/advisor-recommendation-starter";
import { parseRecommendationTriggerConditions } from "@/lib/admin/recommendation-rule-schemas";
import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";

export async function updateAdvisorPillarOverride(
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
    const profile = await getAdvisorProfileOrThrow(userId);
    const slug = normalizePillarSlug(pillarSlug);
    const pillar = await prisma.pillar.findUnique({ where: { slug } });
    if (!pillar) {
      return { success: false as const, error: "Unknown pillar" };
    }

    await prisma.advisorPillarOverride.upsert({
      where: {
        advisorProfileId_pillarId: {
          advisorProfileId: profile.id,
          pillarId: pillar.id,
        },
      },
      create: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
        threshold: (data.threshold ?? DEFAULT_RISK_THRESHOLDS) as unknown as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
        displayName: data.displayName ?? null,
        weight: data.weight ?? 10,
        emphasisMultiplier: data.emphasisMultiplier ?? 1.5,
        displayOrder: data.displayOrder ?? pillar.defaultOrder,
        version: 1,
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

    revalidatePath("/advisor/methodology/pillars");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update pillar"),
    };
  }
}

export async function updateAdvisorPillarNarrative(
  pillarSlug: string,
  data: {
    allNegative: string[];
    allYes: string[];
    midBand: { critical: string[]; high: string[]; medium: string[]; low: string[] };
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const slug = normalizePillarSlug(pillarSlug);
    const pillar = await prisma.pillar.findUnique({ where: { slug } });
    if (!pillar) {
      return { success: false as const, error: "Unknown pillar" };
    }

    await prisma.advisorPillarNarrative.upsert({
      where: {
        advisorProfileId_pillarId: {
          advisorProfileId: profile.id,
          pillarId: pillar.id,
        },
      },
      create: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
        allNegative: data.allNegative,
        allYes: data.allYes,
        midBand: data.midBand,
        version: 1,
      },
      update: {
        allNegative: data.allNegative,
        allYes: data.allYes,
        midBand: data.midBand,
        version: { increment: 1 },
      },
    });

    revalidatePath(`/advisor/methodology/narratives/${slug}`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update narrative"),
    };
  }
}

export async function updateAdvisorPillarQuestion(
  questionId: string,
  data: {
    questionText?: string;
    whyThisMatters?: string | null;
    recommendedActions?: string | null;
    isVisible?: boolean;
    answerType?: string;
    answer0?: string | null;
    answer1?: string | null;
    answer2?: string | null;
    answer3?: string | null;
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const existing = await prisma.advisorPillarQuestion.findFirst({
      where: { id: questionId, advisorProfileId: profile.id },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }

    let writeData: Record<string, unknown> = {
      ...(data.questionText !== undefined ? { questionText: data.questionText } : {}),
      ...(data.whyThisMatters !== undefined ? { whyThisMatters: data.whyThisMatters } : {}),
      ...(data.recommendedActions !== undefined
        ? { recommendedActions: data.recommendedActions }
        : {}),
      ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
    };

    if (existing.sourceKind === AdvisorQuestionSource.CUSTOM && data.answerType !== undefined) {
      const parsed = parseAdvisorAssessmentQuestionInput({
        questionText: data.questionText ?? existing.questionText,
        whyThisMatters:
          data.whyThisMatters !== undefined ? data.whyThisMatters : existing.whyThisMatters,
        recommendedActions:
          data.recommendedActions !== undefined
            ? data.recommendedActions
            : existing.recommendedActions,
        answerType: data.answerType,
        answer0: data.answer0,
        answer1: data.answer1,
        answer2: data.answer2,
        answer3: data.answer3,
      });
      if (!parsed.success) {
        return { success: false as const, error: parsed.error };
      }
      writeData = {
        ...writeData,
        ...buildAdvisorAssessmentQuestionWriteData(parsed.data),
      };
    }

    await prisma.advisorPillarQuestion.update({
      where: { id: questionId },
      data: {
        ...writeData,
        version: { increment: 1 },
      },
    });

    const pillar = await prisma.pillar.findUnique({ where: { id: existing.pillarId } });
    if (pillar) {
      revalidatePath(`/advisor/methodology/questions/${pillar.slug}`);
    }
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update assessment question"),
    };
  }
}

export async function updateAdvisorRecommendationRule(
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
    const profile = await getAdvisorProfileOrThrow(userId);

    const existing = await prisma.advisorRecommendationRule.findFirst({
      where: { id: ruleId, advisorProfileId: profile.id },
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

    await prisma.advisorRecommendationRule.update({
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

    if (existing.pillar) {
      revalidatePath(`/advisor/methodology/recommendations/${existing.pillar.slug}`);
    } else {
      revalidatePath("/advisor/methodology");
    }
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update recommendation rule"),
    };
  }
}

export async function createAdvisorRecommendationRule(
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
    const profile = await getAdvisorProfileOrThrow(userId);
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

    const row = await prisma.advisorRecommendationRule.create({
      data: {
        advisorProfileId: profile.id,
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

    revalidatePath(`/advisor/methodology/recommendations/${slug}`);
    return { success: true as const, ruleId: row.id };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add recommendation rule"),
    };
  }
}

export async function deleteAdvisorRecommendationRule(ruleId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const existing = await prisma.advisorRecommendationRule.findFirst({
      where: { id: ruleId, advisorProfileId: profile.id },
      include: { pillar: true },
    });
    if (!existing) {
      return { success: false as const, error: "Rule not found" };
    }
    if (!canDeleteAdvisorQuestion(existing.sourceKind)) {
      return { success: false as const, error: deleteAdvisorQuestionError() };
    }

    await prisma.advisorRecommendationRule.delete({ where: { id: ruleId } });
    if (existing.pillar) {
      revalidatePath(`/advisor/methodology/recommendations/${existing.pillar.slug}`);
    }
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete recommendation rule"),
    };
  }
}

export async function updateAdvisorIntakeQuestion(
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
    const profile = await getAdvisorProfileOrThrow(userId);

    const existing = await prisma.advisorIntakeQuestion.findFirst({
      where: { id: questionId, advisorProfileId: profile.id },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }

    await prisma.advisorIntakeQuestion.update({
      where: { id: questionId },
      data: {
        ...(data.questionText !== undefined ? { questionText: data.questionText } : {}),
        ...(data.context !== undefined ? { context: data.context } : {}),
        ...(data.helpText !== undefined ? { helpText: data.helpText } : {}),
        ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
        version: { increment: 1 },
      },
    });

    revalidatePath("/advisor/methodology/intake");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update intake question"),
    };
  }
}

export async function createAdvisorPillarQuestion(
  pillarSlug: string,
  data: {
    questionText: string;
    whyThisMatters?: string | null;
    recommendedActions?: string | null;
    answerType?: string;
    answer0?: string | null;
    answer1?: string | null;
    answer2?: string | null;
    answer3?: string | null;
  },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const slug = normalizePillarSlug(pillarSlug);
    const pillar = await prisma.pillar.findUnique({ where: { slug } });
    if (!pillar) {
      return { success: false as const, error: "Unknown pillar" };
    }

    const parsed = parseAdvisorAssessmentQuestionInput(data);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error };
    }

    const siblings = await prisma.advisorPillarQuestion.findMany({
      where: { advisorProfileId: profile.id, pillarId: pillar.id },
      select: { displayOrder: true },
    });

    const row = await prisma.advisorPillarQuestion.create({
      data: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        sectionCode: "CUSTOM",
        displayOrder: nextDisplayOrder(siblings),
        ...buildAdvisorAssessmentQuestionWriteData(parsed.data),
        isVisible: true,
      },
    });

    revalidatePath(`/advisor/methodology/questions/${slug}`);
    return { success: true as const, questionId: row.id };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add assessment question"),
    };
  }
}

export async function createAdvisorIntakeQuestion(data: {
  questionText: string;
  context?: string | null;
}) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const text = data.questionText.trim();
    if (!text) {
      return { success: false as const, error: "Question text is required" };
    }

    const siblings = await prisma.advisorIntakeQuestion.findMany({
      where: { advisorProfileId: profile.id },
      select: { displayOrder: true },
    });
    const order = nextDisplayOrder(siblings);

    const row = await prisma.advisorIntakeQuestion.create({
      data: {
        advisorProfileId: profile.id,
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

    revalidatePath("/advisor/methodology/intake");
    return { success: true as const, questionId: row.id };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add intake question"),
    };
  }
}

export async function deleteAdvisorPillarQuestion(questionId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const existing = await prisma.advisorPillarQuestion.findFirst({
      where: { id: questionId, advisorProfileId: profile.id },
      include: { pillar: true },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }
    if (!canDeleteAdvisorQuestion(existing.sourceKind)) {
      return { success: false as const, error: deleteAdvisorQuestionError() };
    }

    await prisma.advisorPillarQuestion.delete({ where: { id: questionId } });
    revalidatePath(`/advisor/methodology/questions/${existing.pillar.slug}`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete assessment question"),
    };
  }
}

export async function deleteAdvisorIntakeQuestion(questionId: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const existing = await prisma.advisorIntakeQuestion.findFirst({
      where: { id: questionId, advisorProfileId: profile.id },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }
    if (!canDeleteAdvisorQuestion(existing.sourceKind)) {
      return { success: false as const, error: deleteAdvisorQuestionError() };
    }

    await prisma.advisorIntakeQuestion.delete({ where: { id: questionId } });
    revalidatePath("/advisor/methodology/intake");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete intake question"),
    };
  }
}
