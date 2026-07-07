import { NextResponse } from "next/server";
import { requireAdvisorRole, isAdvisorAuthError, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { prisma } from "@/lib/db";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";

/**
 * PATCH /api/advisor/methodology/risk-domains/[pillarId]
 * Update per-advisor pillar override (live config; does not mutate open snapshots).
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

    await prisma.advisorPillarOverride.upsert({
      where: {
        advisorProfileId_pillarId: {
          advisorProfileId: profile.id,
          pillarId: pillar.id,
        },
      },
      create: {
        advisorProfileId: profile.id,
        pillarId: pillar.id,
        threshold: body.threshold ?? DEFAULT_RISK_THRESHOLDS,
        isActive: body.isActive ?? true,
        displayName: body.displayName ?? null,
        weight: body.weight ?? 10,
        emphasisMultiplier: body.emphasisMultiplier ?? 1.5,
        displayOrder: body.displayOrder ?? pillar.defaultOrder,
        version: 1,
      },
      update: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.weight !== undefined ? { weight: body.weight } : {}),
        ...(body.threshold !== undefined ? { threshold: body.threshold } : {}),
        ...(body.emphasisMultiplier !== undefined
          ? { emphasisMultiplier: body.emphasisMultiplier }
          : {}),
        ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
        version: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (isAdvisorAuthError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("methodology pillar PATCH", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
