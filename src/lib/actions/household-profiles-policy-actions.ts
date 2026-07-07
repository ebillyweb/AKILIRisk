"use server";

import { Prisma } from "@prisma/client";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { resolveEnterpriseTeamContext } from "@/lib/enterprise/team-access";
import {
  getEnterpriseHouseholdProfilesEnabled,
  setEnterpriseHouseholdProfilesEnabled,
} from "@/lib/household/profiles-policy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateSchema = z.object({
  householdProfilesEnabled: z.boolean(),
});

export type HouseholdProfilesPolicyResult =
  | { ok: true; householdProfilesEnabled: boolean }
  | { ok: false; message: string };

export async function updateHouseholdProfilesPolicy(
  input: unknown,
): Promise<HouseholdProfilesPolicyResult> {
  const session = await requireAdvisorRole();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid household profiles setting." };
  }

  const team = await resolveEnterpriseTeamContext(session.userId);
  if (team) {
    const before = await getEnterpriseHouseholdProfilesEnabled(team.enterpriseId);

    if (before === parsed.data.householdProfilesEnabled) {
      return { ok: true, householdProfilesEnabled: before };
    }

    await setEnterpriseHouseholdProfilesEnabled(
      team.enterpriseId,
      parsed.data.householdProfilesEnabled,
    );

    void writeAudit({
      actor: {
        userId: session.userId,
        role: session.role,
        email: session.email,
      },
      action: AUDIT_ACTIONS.HOUSEHOLD_PROFILES_POLICY_UPDATE,
      entityType: "AdvisorEnterprise",
      entityId: team.enterpriseId,
      beforeData: { householdProfilesEnabled: before } as unknown as Prisma.InputJsonValue,
      afterData: {
        householdProfilesEnabled: parsed.data.householdProfilesEnabled,
      } as unknown as Prisma.InputJsonValue,
    });

    revalidatePath("/advisor/settings/team");
    revalidatePath("/advisor/settings/access-control");
    revalidatePath("/profiles");

    return { ok: true, householdProfilesEnabled: parsed.data.householdProfilesEnabled };
  }

  if (session.role !== "ADVISOR") {
    return { ok: false, message: "Only advisors can change household profile settings." };
  }

  const profile = await getAdvisorProfileOrThrow(session.userId);
  const before = profile.householdProfilesEnabled;

  if (before === parsed.data.householdProfilesEnabled) {
    return { ok: true, householdProfilesEnabled: before };
  }

  await prisma.advisorProfile.update({
    where: { id: profile.id },
    data: { householdProfilesEnabled: parsed.data.householdProfilesEnabled },
  });

  void writeAudit({
    actor: {
      userId: session.userId,
      role: session.role,
      email: session.email,
    },
    action: AUDIT_ACTIONS.HOUSEHOLD_PROFILES_POLICY_UPDATE,
    entityType: "AdvisorProfile",
    entityId: profile.id,
    beforeData: { householdProfilesEnabled: before } as unknown as Prisma.InputJsonValue,
    afterData: {
      householdProfilesEnabled: parsed.data.householdProfilesEnabled,
    } as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/advisor/settings");
  revalidatePath("/profiles");

  return { ok: true, householdProfilesEnabled: parsed.data.householdProfilesEnabled };
}

export async function getAdvisorHouseholdProfilesPolicy(): Promise<{
  ok: true;
  householdProfilesEnabled: boolean;
}> {
  const session = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(session.userId);
  return { ok: true, householdProfilesEnabled: profile.householdProfilesEnabled };
}
