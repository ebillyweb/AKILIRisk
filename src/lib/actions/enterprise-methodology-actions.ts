"use server";

import { revalidatePath } from "next/cache";
import { AdvisorQuestionSource, IntakeQuestionBankMode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { advisorHubActionErrorMessage, requireAdvisorRole } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import {
  buildAdvisorAssessmentQuestionWriteData,
  parseAdvisorAssessmentQuestionInput,
} from "@/lib/methodology/advisor-assessment-question-config";
import {
  canDeleteAdvisorQuestion,
  deleteAdvisorQuestionError,
  nextDisplayOrder,
} from "@/lib/methodology/advisor-question-policy";
import { syncEnterpriseMethodologyToMembers } from "@/lib/methodology/clone-enterprise-methodology";
import {
  buildAdvisorIntakeQuestionWriteData,
  parseAdvisorIntakeQuestionInput,
} from "@/lib/methodology/advisor-intake-question-config";
import {
  resolveEnterpriseAssessmentQuestionBankMode,
  resolveEnterpriseIntakeQuestionBankMode,
} from "@/lib/methodology/intake-question-bank-mode.server";
import {
  countEnterpriseCustomAssessmentQuestions,
  countEnterpriseCustomIntakeQuestions,
} from "@/lib/methodology/enterprise-methodology-queries";
import {
  isCustomOnlyWithoutSavedQuestions,
  resolveBankModeForUpdate,
} from "@/lib/methodology/intake-question-bank-mode";

function revalidateEnterpriseMethodologyPaths(pillarSlug?: string) {
  revalidatePath("/advisor/enterprise/methodology");
  revalidatePath("/advisor/enterprise/methodology/risk-domains");
  revalidatePath("/advisor/enterprise/methodology/intake");
  revalidatePath("/advisor/enterprise/methodology/questions", "layout");
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
    answerType?: string;
    answer0?: string | null;
    answer1?: string | null;
    answer2?: string | null;
    answer3?: string | null;
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

    await prisma.enterprisePillarQuestion.update({
      where: { id: questionId },
      data: {
        ...writeData,
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
    answerType?: string;
    answer0?: string | null;
    answer1?: string | null;
    answer2?: string | null;
    answer3?: string | null;
    options?: unknown;
    switchToCombinedBank?: boolean;
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

    const bankMode = await resolveEnterpriseAssessmentQuestionBankMode(team.enterpriseId);
    const needsCombinedSwitch = bankMode === IntakeQuestionBankMode.PLATFORM;

    if (needsCombinedSwitch && !data.switchToCombinedBank) {
      return {
        success: false as const,
        error: "Confirm adding a custom question to the combined question bank.",
      };
    }

    const parsed = parseAdvisorAssessmentQuestionInput(data);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error };
    }

    const row = await prisma.$transaction(async (tx) => {
      if (needsCombinedSwitch) {
        await tx.advisorEnterprise.update({
          where: { id: team.enterpriseId },
          data: { assessmentQuestionBankMode: IntakeQuestionBankMode.COMBINED },
        });
      }

      const siblings = await tx.enterprisePillarQuestion.findMany({
        where: { enterpriseId: team.enterpriseId, pillarId: pillar.id },
        select: { displayOrder: true },
      });

      return tx.enterprisePillarQuestion.create({
        data: {
          enterpriseId: team.enterpriseId,
          pillarId: pillar.id,
          sourceKind: AdvisorQuestionSource.CUSTOM,
          sectionCode: "CUSTOM",
          displayOrder: nextDisplayOrder(siblings),
          ...buildAdvisorAssessmentQuestionWriteData(parsed.data),
          isVisible: true,
        },
      });
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, slug);
    return {
      success: true as const,
      questionId: row.id,
      switchedToCombinedBank: needsCombinedSwitch,
    };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to add firm assessment question"),
    };
  }
}

export async function updateEnterpriseAssessmentQuestionBankMode(mode: IntakeQuestionBankMode) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const customCount = await countEnterpriseCustomAssessmentQuestions(team.enterpriseId);
    const { mode: resolvedMode, coercedToPlatform } = resolveBankModeForUpdate(mode, customCount);

    await prisma.advisorEnterprise.update({
      where: { id: team.enterpriseId },
      data: { assessmentQuestionBankMode: resolvedMode },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return { success: true as const, coercedToPlatform };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update firm assessment question bank"),
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

    const remaining = await countEnterpriseCustomAssessmentQuestions(team.enterpriseId);
    const bankMode = await resolveEnterpriseAssessmentQuestionBankMode(team.enterpriseId);
    let switchedToPlatform = false;
    if (isCustomOnlyWithoutSavedQuestions(bankMode, remaining)) {
      await prisma.advisorEnterprise.update({
        where: { id: team.enterpriseId },
        data: { assessmentQuestionBankMode: IntakeQuestionBankMode.PLATFORM },
      });
      switchedToPlatform = true;
    }

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId, existing.pillar?.slug);
    return { success: true as const, switchedToPlatform };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete firm assessment question"),
    };
  }
}

export async function updateEnterpriseIntakeQuestionBankMode(mode: IntakeQuestionBankMode) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const customCount = await countEnterpriseCustomIntakeQuestions(team.enterpriseId);
    const { mode: resolvedMode, coercedToPlatform } = resolveBankModeForUpdate(mode, customCount);

    await prisma.advisorEnterprise.update({
      where: { id: team.enterpriseId },
      data: { intakeQuestionBankMode: resolvedMode },
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return { success: true as const, coercedToPlatform };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update firm intake question bank"),
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
    answerType?: string;
    answer0?: string | null;
    answer1?: string | null;
    answer2?: string | null;
    answer3?: string | null;
    options?: unknown;
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

    let writeData: Record<string, unknown> = {
      ...(data.questionText !== undefined ? { questionText: data.questionText } : {}),
      ...(data.context !== undefined ? { context: data.context } : {}),
      ...(data.helpText !== undefined ? { helpText: data.helpText } : {}),
      ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
    };

    if (existing.sourceKind === AdvisorQuestionSource.CUSTOM && data.answerType !== undefined) {
      const parsed = parseAdvisorIntakeQuestionInput({
        questionText: data.questionText ?? existing.questionText,
        whyThisMatters: data.context !== undefined ? data.context : existing.context,
        recommendedActions: existing.recommendedActions,
        answerType: data.answerType,
        answer0: data.answer0,
        answer1: data.answer1,
        answer2: data.answer2,
        answer3: data.answer3,
        options: data.options,
      });
      if (!parsed.success) {
        return { success: false as const, error: parsed.error };
      }
      writeData = {
        ...writeData,
        ...buildAdvisorIntakeQuestionWriteData(parsed.data),
      };
    }

    await prisma.enterpriseIntakeQuestion.update({
      where: { id: questionId },
      data: {
        ...writeData,
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
  answerType?: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  options?: unknown;
  switchToCombinedBank?: boolean;
}) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const bankMode = await resolveEnterpriseIntakeQuestionBankMode(team.enterpriseId);
    const needsCombinedSwitch = bankMode === IntakeQuestionBankMode.PLATFORM;

    if (needsCombinedSwitch && !data.switchToCombinedBank) {
      return {
        success: false as const,
        error: "Confirm adding a custom question to the combined question bank.",
      };
    }

    const parsed = parseAdvisorIntakeQuestionInput({
      questionText: data.questionText,
      whyThisMatters: data.context ?? null,
      recommendedActions: null,
      answerType: data.answerType ?? "fillable",
      answer0: data.answer0,
      answer1: data.answer1,
      answer2: data.answer2,
      answer3: data.answer3,
      options: data.options,
    });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error };
    }

    const writeData = buildAdvisorIntakeQuestionWriteData(parsed.data);

    const row = await prisma.$transaction(async (tx) => {
      if (needsCombinedSwitch) {
        await tx.advisorEnterprise.update({
          where: { id: team.enterpriseId },
          data: { intakeQuestionBankMode: IntakeQuestionBankMode.COMBINED },
        });
      }

      const siblings = await tx.enterpriseIntakeQuestion.findMany({
        where: { enterpriseId: team.enterpriseId },
        select: { displayOrder: true },
      });
      const order = nextDisplayOrder(siblings);

      return tx.enterpriseIntakeQuestion.create({
        data: {
          enterpriseId: team.enterpriseId,
          sourceKind: AdvisorQuestionSource.CUSTOM,
          displayOrder: order,
          questionNumber: String(order + 1),
          ...writeData,
          isVisible: true,
        },
      });
    });

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return {
      success: true as const,
      questionId: row.id,
      switchedToCombinedBank: needsCombinedSwitch,
    };
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

    const remaining = await countEnterpriseCustomIntakeQuestions(team.enterpriseId);
    const bankMode = await resolveEnterpriseIntakeQuestionBankMode(team.enterpriseId);
    let switchedToPlatform = false;
    if (isCustomOnlyWithoutSavedQuestions(bankMode, remaining)) {
      await prisma.advisorEnterprise.update({
        where: { id: team.enterpriseId },
        data: { intakeQuestionBankMode: IntakeQuestionBankMode.PLATFORM },
      });
      switchedToPlatform = true;
    }

    await syncAfterEnterpriseMethodologyChange(team.enterpriseId);
    return { success: true as const, switchedToPlatform };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to delete firm intake question"),
    };
  }
}
