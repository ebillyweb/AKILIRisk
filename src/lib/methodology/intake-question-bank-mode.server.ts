import "server-only";

import { IntakeQuestionBankMode, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function resolveEnterpriseIntakeQuestionBankMode(
  enterpriseId: string,
): Promise<IntakeQuestionBankMode> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { intakeQuestionBankMode: true },
  });
  return enterprise?.intakeQuestionBankMode ?? IntakeQuestionBankMode.PLATFORM;
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

export function intakeQuestionBankModeUpdate(
  mode: IntakeQuestionBankMode,
): Prisma.AdvisorProfileUpdateInput {
  return { intakeQuestionBankMode: mode };
}
