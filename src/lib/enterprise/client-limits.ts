import "server-only";

import { prisma } from "@/lib/db";
import {
  ClientLimitError,
  countActiveClientsForAdvisor,
  type DbLike,
} from "@/lib/billing/subscription-service";

export async function countEnterpriseClients(
  enterpriseId: string,
  db: DbLike = prisma
): Promise<number> {
  const profiles = await db.advisorProfile.findMany({
    where: { enterpriseId },
    select: { id: true },
  });
  if (profiles.length === 0) return 0;

  const profileIds = profiles.map((p) => p.id);
  const assignments = await db.clientAdvisorAssignment.findMany({
    where: {
      advisorId: { in: profileIds },
      status: "ACTIVE",
    },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  return assignments.length;
}

export async function checkEnterpriseInviteLimits(
  enterpriseId: string,
  advisorProfileId: string,
  db: DbLike = prisma
): Promise<{
  canAddClient: boolean;
  firmCount: number;
  firmLimit: number;
  advisorCount: number;
  advisorLimit: number;
  blockReason: "firm" | "advisor" | null;
}> {
  const enterprise = await db.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      clientLimit: true,
      perAdvisorClientLimit: true,
    },
  });

  if (!enterprise) {
    return {
      canAddClient: false,
      firmCount: 0,
      firmLimit: 0,
      advisorCount: 0,
      advisorLimit: 0,
      blockReason: "firm",
    };
  }

  const [firmCount, advisorCount] = await Promise.all([
    countEnterpriseClients(enterpriseId, db),
    countActiveClientsForAdvisor(advisorProfileId, db),
  ]);

  if (firmCount >= enterprise.clientLimit) {
    return {
      canAddClient: false,
      firmCount,
      firmLimit: enterprise.clientLimit,
      advisorCount,
      advisorLimit: enterprise.perAdvisorClientLimit,
      blockReason: "firm",
    };
  }

  if (advisorCount >= enterprise.perAdvisorClientLimit) {
    return {
      canAddClient: false,
      firmCount,
      firmLimit: enterprise.clientLimit,
      advisorCount,
      advisorLimit: enterprise.perAdvisorClientLimit,
      blockReason: "advisor",
    };
  }

  return {
    canAddClient: true,
    firmCount,
    firmLimit: enterprise.clientLimit,
    advisorCount,
    advisorLimit: enterprise.perAdvisorClientLimit,
    blockReason: null,
  };
}

export async function assertCanAddClientForEnterpriseInvite(
  enterpriseId: string,
  advisorProfileId: string,
  db: DbLike = prisma
): Promise<void> {
  const check = await checkEnterpriseInviteLimits(
    enterpriseId,
    advisorProfileId,
    db
  );
  if (check.canAddClient) return;

  if (check.blockReason === "firm") {
    throw new ClientLimitError(
      `Firm client limit reached (${check.firmCount}/${check.firmLimit}). Contact your account manager to increase capacity.`,
      {
        currentCount: check.firmCount,
        limit: check.firmLimit,
        upgradePath: "/advisor/billing",
      }
    );
  }

  throw new ClientLimitError(
    `Your client limit reached (${check.advisorCount}/${check.advisorLimit}). Contact your firm administrator.`,
    {
      currentCount: check.advisorCount,
      limit: check.advisorLimit,
      upgradePath: "/advisor/billing",
    }
  );
}
