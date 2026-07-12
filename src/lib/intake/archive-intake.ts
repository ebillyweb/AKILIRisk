import "server-only";

import { prisma } from "@/lib/db";

/** Active intake interviews are those not archived by an advisor restart. */
export function whereActiveIntakeInterview(
  userId?: string,
): { userId?: string; archivedAt: null } {
  return userId ? { userId, archivedAt: null } : { archivedAt: null };
}

export async function archiveActiveIntakeInterviewsForUser(
  userId: string,
  archivedAt: Date = new Date(),
): Promise<number> {
  const result = await prisma.intakeInterview.updateMany({
    where: whereActiveIntakeInterview(userId),
    data: { archivedAt },
  });
  return result.count;
}
