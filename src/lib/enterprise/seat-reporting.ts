import "server-only";

import { prisma } from "@/lib/db";

export type EnterpriseSeatUsage = {
  activeSeats: number;
  seatLimit: number;
  seatOverage: number;
};

export async function getEnterpriseSeatUsage(
  enterpriseId: string
): Promise<EnterpriseSeatUsage | null> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { seatLimit: true },
  });
  if (!enterprise) return null;

  const activeSeats = await prisma.enterpriseMembership.count({
    where: { enterpriseId, status: "ACTIVE" },
  });

  return {
    activeSeats,
    seatLimit: enterprise.seatLimit,
    seatOverage: Math.max(0, activeSeats - enterprise.seatLimit),
  };
}
