import { prisma } from "@/lib/db";

/** Persist the user's most recent successful sign-in timestamp. */
export async function recordUserLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}
