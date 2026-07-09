import "server-only";

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findUserByEmail, userEmailWriteData } from "@/lib/auth/user-email";

export type ProvisionFacilitatedClientResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string; code: "blocked" | "exists" };

/**
 * Create or reuse a client User for an advisor-led session (no invitation).
 */
export async function provisionFacilitatedClient(input: {
  email: string;
  name: string;
  advisorProfileId: string;
}): Promise<ProvisionFacilitatedClientResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail, {
    where: { deletedAt: null },
    select: { id: true, role: true },
  });

  if (existing && existing.role !== "USER") {
    return {
      ok: false,
      error:
        "This email is already registered as an advisor or staff account, so it can't be used to sign in as a client. Please use the client's personal email.",
      code: "blocked",
    };
  }

  if (existing) {
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId: existing.id,
        advisorId: input.advisorProfileId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!assignment) {
      await prisma.clientAdvisorAssignment.create({
        data: {
          clientId: existing.id,
          advisorId: input.advisorProfileId,
        },
      });
    }
    return { ok: true, userId: existing.id, created: false };
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...userEmailWriteData(normalizedEmail),
        role: "USER" as UserRole,
        password: null,
        name: input.name.trim(),
        emailVerified: new Date(),
      },
      select: { id: true },
    });
    await tx.clientProfile.create({ data: { userId: created.id } });
    await tx.clientAdvisorAssignment.create({
      data: {
        clientId: created.id,
        advisorId: input.advisorProfileId,
      },
    });
    return created;
  });

  return { ok: true, userId: user.id, created: true };
}
