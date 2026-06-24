import "server-only";

import { prisma } from "@/lib/db";
import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";

export type PlatformPillarView = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  defaultOrder: number;
};

/** Load platform pillars from DB; fall back to starter catalog if empty. */
export async function loadPlatformPillars(): Promise<PlatformPillarView[]> {
  const rows = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });
  if (rows.length === 0) {
    return PLATFORM_PILLAR_CATALOG.map((p) => ({
      id: p.slug,
      slug: p.slug,
      name: p.canonicalName,
      summary: p.description,
      defaultOrder: p.defaultOrder,
    }));
  }
  return rows.map((p) => ({
    id: p.slug,
    slug: p.slug,
    name: p.canonicalName,
    summary: p.description ?? "",
    defaultOrder: p.defaultOrder,
  }));
}

export async function loadPlatformPillarSlugs(): Promise<string[]> {
  const pillars = await loadPlatformPillars();
  return pillars.map((p) => p.slug);
}

export async function resolveSnapshotIdForClient(
  clientUserId: string,
): Promise<string | null> {
  const interview = await prisma.intakeInterview.findFirst({
    where: { userId: clientUserId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!interview) return null;
  const snap = await prisma.intakeSnapshot.findUnique({
    where: { intakeInterviewId: interview.id },
    select: { id: true },
  });
  return snap?.id ?? null;
}
