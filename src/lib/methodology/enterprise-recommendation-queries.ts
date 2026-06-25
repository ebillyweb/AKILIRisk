import "server-only";

import { prisma } from "@/lib/db";
import {
  cloneEnterpriseDefaultsIfNeeded,
  syncMissingPlatformEnterpriseRules,
} from "@/lib/methodology/clone-enterprise-defaults";

async function ensureEnterpriseRulesCloned(enterpriseId: string): Promise<void> {
  const cloned = await cloneEnterpriseDefaultsIfNeeded(enterpriseId);
  if (!cloned) {
    await syncMissingPlatformEnterpriseRules(enterpriseId);
  }
}

export async function loadEnterpriseRecommendationRules(
  enterpriseId: string,
  pillarSlug?: string,
) {
  await ensureEnterpriseRulesCloned(enterpriseId);
  const pillar = pillarSlug
    ? await prisma.pillar.findUnique({ where: { slug: pillarSlug } })
    : null;

  return prisma.enterpriseRecommendationRule.findMany({
    where: {
      enterpriseId,
      ...(pillar ? { pillarId: pillar.id } : {}),
    },
    include: { pillar: true },
    orderBy: { priority: "desc" },
  });
}
