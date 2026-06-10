import "server-only";

import type { EnterpriseRole } from "@prisma/client";

import { prisma } from "@/lib/db";

import { resolveBillingContext } from "./billing-context";

export type EnterpriseTeamContext = {
  enterpriseId: string;
  enterpriseName: string;
  role: EnterpriseRole;
  advisorProfileId: string;
};

export async function resolveEnterpriseTeamContext(
  userId: string
): Promise<EnterpriseTeamContext | null> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise") return null;
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return null;

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: ctx.enterpriseId },
    select: { name: true },
  });
  if (!enterprise) return null;

  return {
    enterpriseId: ctx.enterpriseId,
    enterpriseName: enterprise.name,
    role: ctx.role,
    advisorProfileId: ctx.advisorProfileId,
  };
}

export async function requireEnterpriseTeamManager(userId: string) {
  const team = await resolveEnterpriseTeamContext(userId);
  if (!team) {
    throw new Error("Unauthorized: enterprise team management requires OWNER or ADMIN role");
  }
  return team;
}

export async function canAccessEnterpriseTeamSettings(
  userId: string
): Promise<boolean> {
  return (await resolveEnterpriseTeamContext(userId)) != null;
}
