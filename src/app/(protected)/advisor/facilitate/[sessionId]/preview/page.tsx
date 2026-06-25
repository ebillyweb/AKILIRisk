import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FacilitatedRiskPreviewView } from "@/components/advisor/facilitate/FacilitatedRiskPreviewView";
import { resolveIncludedPillars } from "@/lib/assessment/included-pillars";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { normalizePillarScoreId, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";

export default async function FacilitatedPreviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  const facilitated = await assertFacilitatedSessionStep(sessionId, session!.user!.id, [
    "PREVIEW",
  ]);

  if (!facilitated.assessmentId) {
    throw new Error("Assessment not linked to session");
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: facilitated.assessmentId },
    select: { includedPillars: true },
  });

  const catalog = await getPlatformPillarCatalog();
  const includedPillars = resolveIncludedPillars(assessment?.includedPillars ?? [], catalog);
  const includedSet = new Set(includedPillars.map(normalizePillarSlug));

  const pillarScoreRows = await prisma.pillarScore.findMany({
    where: { assessmentId: facilitated.assessmentId },
    select: { pillar: true, score: true, riskLevel: true },
    orderBy: { pillar: "asc" },
  });

  const pillarScores = pillarScoreRows
    .map((row) => ({
      pillar: normalizePillarScoreId(row.pillar),
      score: row.score,
      riskLevel: row.riskLevel,
    }))
    .filter((row) => includedSet.has(normalizePillarSlug(row.pillar)));

  return (
    <FacilitatedRiskPreviewView
      sessionId={sessionId}
      clientName={facilitated.client.name}
      includedPillars={includedPillars}
      pillarScores={pillarScores}
      pillarCatalog={catalog}
    />
  );
}
