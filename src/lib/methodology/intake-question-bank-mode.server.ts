import "server-only";

import { AdvisorQuestionSource, IntakeQuestionBankMode, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  effectiveQuestionBankMode,
  isCustomOnlyWithoutSavedQuestions,
} from "@/lib/methodology/intake-question-bank-mode";

const CUSTOM_SOURCES = [AdvisorQuestionSource.CUSTOM, AdvisorQuestionSource.ENTERPRISE];

export async function resolveEnterpriseIntakeQuestionBankMode(
  enterpriseId: string,
): Promise<IntakeQuestionBankMode> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { intakeQuestionBankMode: true },
  });
  return enterprise?.intakeQuestionBankMode ?? IntakeQuestionBankMode.PLATFORM;
}

export async function resolveEnterpriseAssessmentQuestionBankMode(
  enterpriseId: string,
): Promise<IntakeQuestionBankMode> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { assessmentQuestionBankMode: true },
  });
  return enterprise?.assessmentQuestionBankMode ?? IntakeQuestionBankMode.PLATFORM;
}

export async function resolveAdvisorIntakeQuestionBankMode(
  advisorProfileId: string,
): Promise<IntakeQuestionBankMode> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      intakeQuestionBankMode: true,
      enterpriseId: true,
    },
  });
  if (!profile) return IntakeQuestionBankMode.PLATFORM;

  if (profile.enterpriseId) {
    return resolveEnterpriseIntakeQuestionBankMode(profile.enterpriseId);
  }

  return profile.intakeQuestionBankMode;
}

export async function resolveAdvisorAssessmentQuestionBankMode(
  advisorProfileId: string,
): Promise<IntakeQuestionBankMode> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      assessmentQuestionBankMode: true,
      enterpriseId: true,
    },
  });
  if (!profile) return IntakeQuestionBankMode.PLATFORM;

  if (profile.enterpriseId) {
    return resolveEnterpriseAssessmentQuestionBankMode(profile.enterpriseId);
  }

  return profile.assessmentQuestionBankMode;
}

export function intakeQuestionBankModeUpdate(
  mode: IntakeQuestionBankMode,
): Prisma.AdvisorProfileUpdateInput {
  return { intakeQuestionBankMode: mode };
}

async function countAdvisorCustomIntakeQuestions(advisorProfileId: string): Promise<number> {
  return prisma.advisorIntakeQuestion.count({
    where: { advisorProfileId, sourceKind: { in: CUSTOM_SOURCES } },
  });
}

async function countAdvisorCustomAssessmentQuestions(advisorProfileId: string): Promise<number> {
  return prisma.advisorPillarQuestion.count({
    where: { advisorProfileId, sourceKind: { in: CUSTOM_SOURCES } },
  });
}

async function countEnterpriseCustomIntakeQuestions(enterpriseId: string): Promise<number> {
  return prisma.enterpriseIntakeQuestion.count({
    where: { enterpriseId, sourceKind: { in: CUSTOM_SOURCES } },
  });
}

async function countEnterpriseCustomAssessmentQuestions(enterpriseId: string): Promise<number> {
  return prisma.enterprisePillarQuestion.count({
    where: { enterpriseId, sourceKind: { in: CUSTOM_SOURCES } },
  });
}

/** Persist platform when custom-only is stored but no custom questions exist. */
export async function ensureAdvisorIntakeQuestionBankModeValid(
  advisorProfileId: string,
): Promise<{ bankMode: IntakeQuestionBankMode; wasNormalized: boolean }> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true, intakeQuestionBankMode: true },
  });
  if (!profile || profile.enterpriseId) {
    const stored = profile
      ? await resolveEnterpriseIntakeQuestionBankMode(profile.enterpriseId!)
      : IntakeQuestionBankMode.PLATFORM;
    const count = profile?.enterpriseId
      ? await countEnterpriseCustomIntakeQuestions(profile.enterpriseId)
      : 0;
    return { bankMode: effectiveQuestionBankMode(stored, count), wasNormalized: false };
  }

  const customCount = await countAdvisorCustomIntakeQuestions(advisorProfileId);
  if (isCustomOnlyWithoutSavedQuestions(profile.intakeQuestionBankMode, customCount)) {
    await prisma.advisorProfile.update({
      where: { id: advisorProfileId },
      data: { intakeQuestionBankMode: IntakeQuestionBankMode.PLATFORM },
    });
    return { bankMode: IntakeQuestionBankMode.PLATFORM, wasNormalized: true };
  }

  return { bankMode: profile.intakeQuestionBankMode, wasNormalized: false };
}

export async function ensureAdvisorAssessmentQuestionBankModeValid(
  advisorProfileId: string,
): Promise<{ bankMode: IntakeQuestionBankMode; wasNormalized: boolean }> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true, assessmentQuestionBankMode: true },
  });
  if (!profile || profile.enterpriseId) {
    const stored = profile
      ? await resolveEnterpriseAssessmentQuestionBankMode(profile.enterpriseId!)
      : IntakeQuestionBankMode.PLATFORM;
    const count = profile?.enterpriseId
      ? await countEnterpriseCustomAssessmentQuestions(profile.enterpriseId)
      : 0;
    return { bankMode: effectiveQuestionBankMode(stored, count), wasNormalized: false };
  }

  const customCount = await countAdvisorCustomAssessmentQuestions(advisorProfileId);
  if (isCustomOnlyWithoutSavedQuestions(profile.assessmentQuestionBankMode, customCount)) {
    await prisma.advisorProfile.update({
      where: { id: advisorProfileId },
      data: { assessmentQuestionBankMode: IntakeQuestionBankMode.PLATFORM },
    });
    return { bankMode: IntakeQuestionBankMode.PLATFORM, wasNormalized: true };
  }

  return { bankMode: profile.assessmentQuestionBankMode, wasNormalized: false };
}

export async function ensureEnterpriseIntakeQuestionBankModeValid(
  enterpriseId: string,
): Promise<{ bankMode: IntakeQuestionBankMode; wasNormalized: boolean }> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { intakeQuestionBankMode: true },
  });
  if (!enterprise) {
    return { bankMode: IntakeQuestionBankMode.PLATFORM, wasNormalized: false };
  }

  const customCount = await countEnterpriseCustomIntakeQuestions(enterpriseId);
  if (isCustomOnlyWithoutSavedQuestions(enterprise.intakeQuestionBankMode, customCount)) {
    await prisma.advisorEnterprise.update({
      where: { id: enterpriseId },
      data: { intakeQuestionBankMode: IntakeQuestionBankMode.PLATFORM },
    });
    return { bankMode: IntakeQuestionBankMode.PLATFORM, wasNormalized: true };
  }

  return { bankMode: enterprise.intakeQuestionBankMode, wasNormalized: false };
}

export async function ensureEnterpriseAssessmentQuestionBankModeValid(
  enterpriseId: string,
): Promise<{ bankMode: IntakeQuestionBankMode; wasNormalized: boolean }> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { assessmentQuestionBankMode: true },
  });
  if (!enterprise) {
    return { bankMode: IntakeQuestionBankMode.PLATFORM, wasNormalized: false };
  }

  const customCount = await countEnterpriseCustomAssessmentQuestions(enterpriseId);
  if (isCustomOnlyWithoutSavedQuestions(enterprise.assessmentQuestionBankMode, customCount)) {
    await prisma.advisorEnterprise.update({
      where: { id: enterpriseId },
      data: { assessmentQuestionBankMode: IntakeQuestionBankMode.PLATFORM },
    });
    return { bankMode: IntakeQuestionBankMode.PLATFORM, wasNormalized: true };
  }

  return { bankMode: enterprise.assessmentQuestionBankMode, wasNormalized: false };
}

export async function resolveEffectiveAdvisorIntakeQuestionBankMode(
  advisorProfileId: string,
): Promise<IntakeQuestionBankMode> {
  const stored = await resolveAdvisorIntakeQuestionBankMode(advisorProfileId);
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true },
  });
  const customCount = profile?.enterpriseId
    ? await countEnterpriseCustomIntakeQuestions(profile.enterpriseId)
    : await countAdvisorCustomIntakeQuestions(advisorProfileId);
  return effectiveQuestionBankMode(stored, customCount);
}

export async function resolveEffectiveAdvisorAssessmentQuestionBankMode(
  advisorProfileId: string,
): Promise<IntakeQuestionBankMode> {
  const stored = await resolveAdvisorAssessmentQuestionBankMode(advisorProfileId);
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true },
  });
  const customCount = profile?.enterpriseId
    ? await countEnterpriseCustomAssessmentQuestions(profile.enterpriseId)
    : await countAdvisorCustomAssessmentQuestions(advisorProfileId);
  return effectiveQuestionBankMode(stored, customCount);
}
