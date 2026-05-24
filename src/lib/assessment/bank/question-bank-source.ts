import "server-only";

import { PillarCategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/** True when scored pillar DDL rows exist (admin + client question bank is operational). */
export async function isPillarQuestionBankActive(): Promise<boolean> {
  const count = await prisma.pillarQuestion.count({
    where: {
      section: { category: { kind: { not: PillarCategoryKind.INTAKE } } },
    },
  });
  return count > 0;
}
