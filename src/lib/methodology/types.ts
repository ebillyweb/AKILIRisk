import type { RiskThresholds } from "@/lib/assessment/governance-rubric";
import type { GovernanceQuestionWire } from "@/lib/assessment/bank/behaviors";
import type { RecommendationCondition } from "@/lib/assessment/engines/recommendation-engine";
import type { PillarMidBandNarratives } from "@/lib/assessment/pillar-outcome-expectations-mid-band";

export const SNAPSHOT_SCHEMA_VERSION = 2 as const;
export const SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024;

export type SnapshotPillarOverride = {
  pillarId: string;
  slug: string;
  canonicalName: string;
  isActive: boolean;
  displayName: string | null;
  weight: number;
  threshold: RiskThresholds;
  emphasisMultiplier: number;
  displayOrder: number;
  version: number;
};

export type SnapshotIntakeQuestion = {
  id: string;
  displayOrder: number;
  questionNumber: string | null;
  questionText: string;
  context: string | null;
  helpText: string | null;
  learnMore: string | null;
  answerType: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  options: unknown;
  relatedPillarIds: string[];
  recommendedActions: string | null;
  isVisible: boolean;
  version: number;
};

export type SnapshotRecRule = {
  id: string;
  pillarId: string | null;
  pillarSlug: string | null;
  name: string;
  serviceId: string;
  conditions: RecommendationCondition[];
  priority: number;
  isActive: boolean;
  version: number;
};

export type SnapshotPillarNarrative = {
  pillarId: string;
  slug: string;
  allNegative: string[];
  allYes: string[];
  midBand: PillarMidBandNarratives;
  version: number;
};

export type MethodologySnapshotBlob = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  catalogVersion: number;
  includedPillarSlugs: string[];
  pillars: SnapshotPillarOverride[];
  assessmentQuestions: Record<string, GovernanceQuestionWire[]>;
  intakeQuestions: SnapshotIntakeQuestion[];
  pillarNarratives: Record<string, SnapshotPillarNarrative>;
  recRules: SnapshotRecRule[];
};

export type ParsedMethodologySnapshot = MethodologySnapshotBlob & {
  snapshotId: string;
  advisorProfileId: string;
  takenAt: Date;
};
