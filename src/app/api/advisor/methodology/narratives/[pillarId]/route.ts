import { NextResponse } from "next/server";
import { requireAdvisorRole, isAdvisorAuthError, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/advisor/methodology/narratives/[pillarId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pillarId: string }> },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const { pillarId } = await params;
    const slug = normalizePillarSlug(pillarId);
    const body = await request.json();

    const pillar = await prisma.pillar.findUnique({ where: { slug } });
    if (!pillar) {
      return NextResponse.json({ error: "Unknown pillar" }, { status: 404 });
    }

    const row = await prisma.advisorPillarNarrative.upsert({
      where: {
        advisorProfileId_pillarId: {
          advisorProfileId: profile.id,
          pillarId: pillar.id,
        },
      },
      create: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
        allNegative: body.allNegative ?? [],
        allYes: body.allYes ?? [],
        midBand: body.midBand ?? { critical: [], high: [], medium: [], low: [] },
        version: 1,
      },
      update: {
        ...(body.allNegative !== undefined ? { allNegative: body.allNegative } : {}),
        ...(body.allYes !== undefined ? { allYes: body.allYes } : {}),
        ...(body.midBand !== undefined ? { midBand: body.midBand } : {}),
        version: { increment: 1 },
      },
    });

    return NextResponse.json({ narrative: row });
  } catch (e) {
    if (isAdvisorAuthError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("methodology narrative PATCH", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
