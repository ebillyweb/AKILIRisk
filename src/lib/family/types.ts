// Family dashboard data types for self-service family portal

// Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only family
// dashboard view of household members. fullName replaced with
// displayLabel; sex + birthYear surfaced for completeness.
export interface FamilyHouseholdMember {
  displayLabel: string;
  birthYear: number | null;
  sex: string | null;
  relationship: string;
  governanceRoles: string[];
}

export interface FamilyPillarScore {
  pillar: string;
  pillarName: string;
  score: number;
  weight: number;
  riskLevel: string;
}

export interface FamilyHistoricalAssessment {
  assessmentId: string;
  completedAt: string;
  overallScore: number;
  pillarScores: FamilyPillarScore[];
  trendDirection: 'improving' | 'declining' | 'stable' | 'new';
}

export interface FamilyDashboardData {
  householdMembers: FamilyHouseholdMember[];
  currentScore: number | null;
  currentPillarScores: FamilyPillarScore[];
  historicalAssessments: FamilyHistoricalAssessment[];
  advisorEmphasis: string[];
  hasMultipleAssessments: boolean;
}