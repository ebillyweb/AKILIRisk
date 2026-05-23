import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";

/**
 * Resolve which pillar to score from client store or persisted assessment row.
 */
export async function resolveScoringPillar(
  assessmentId: string,
  storePillar: string | null | undefined
): Promise<string> {
  if (storePillar) {
    return normalizePillarSlug(storePillar);
  }

  const res = await fetch(`/api/assessment/${assessmentId}`);
  if (!res.ok) {
    return "governance";
  }

  const data = (await res.json()) as { currentPillar?: string | null };
  if (typeof data.currentPillar === "string" && data.currentPillar.length > 0) {
    return normalizePillarSlug(data.currentPillar);
  }

  return "governance";
}
