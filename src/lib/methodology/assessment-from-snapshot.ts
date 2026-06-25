import { wireQuestionsToQuestions } from "@/lib/assessment/bank/behaviors";
import { pillarDefinitionFor, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import type { Pillar, Question } from "@/lib/assessment/types";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";
import type { ParsedMethodologySnapshot } from "@/lib/methodology/types";
import {
  snapshotQuestionsForPillar,
} from "@/lib/methodology/snapshot-helpers";

export function pillarQuestionsFromSnapshot(
  snapshot: ParsedMethodologySnapshot,
  pillarSlug: string,
): Question[] {
  const wires = snapshotQuestionsForPillar(snapshot, pillarSlug);
  if (wires.length === 0) return [];
  return wireQuestionsToQuestions(wires);
}

export function pillarAssessmentConfigFromSnapshot(
  snapshot: ParsedMethodologySnapshot,
  pillarSlug: string,
  catalog: readonly PillarCatalogEntry[],
): { pillarData: Pillar; questions: Question[] } | null {
  const normalized = normalizePillarSlug(pillarSlug);
  const questions = pillarQuestionsFromSnapshot(snapshot, normalized);
  const pillarData = pillarDefinitionFor(normalized, catalog);
  return { pillarData, questions };
}
