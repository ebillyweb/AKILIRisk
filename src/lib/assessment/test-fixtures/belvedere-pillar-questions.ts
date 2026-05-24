/**
 * Belvedere-aligned pillar question fixtures for unit tests.
 * Mirrors workbook / `belvedere-pillar-ddl-seed.sql` semantics — not the removed static bank.
 */

import { PillarCategoryKind } from "@prisma/client";
import { wireQuestionsToQuestions } from "@/lib/assessment/bank/behaviors";
import {
  pillarQuestionRowToWire,
  type PillarQuestionWithHierarchy,
} from "@/lib/assessment/bank/pillar-question-wire";
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";
import type { Pillar, Question } from "@/lib/assessment/types";

/** Stable ids used by recommendation rules and tests (see family-governance-recommendation-rules). */
export const BELVEDERE_TEST_QUESTION_IDS = {
  govA2: "belvedere-gov-a2",
  govA3: "belvedere-gov-a3",
  govA4a: "belvedere-gov-a4a",
  govA5: "belvedere-gov-a5",
  govA6: "belvedere-gov-a6",
  govB1: "belvedere-gov-b1",
  govB4: "belvedere-gov-b4",
  cyberA3: "belvedere-cyber-a3",
  cyberDh01: "belvedere-cyber-dh-01",
  physA1: "belvedere-phys-a1",
  physB2: "belvedere-phys-b2",
  physE1: "belvedere-phys-e1",
  insEnv04: "belvedere-ins-env04",
  insHealth04: "belvedere-ins-health04",
  insMrr01: "belvedere-ins-mrr01",
  insMrr03: "belvedere-ins-mrr03",
  geoEnv01: "belvedere-geo-env01",
  geoEnv02: "belvedere-geo-env02",
  geoEnv03: "belvedere-geo-env03",
  geoEnv04: "belvedere-geo-env04",
  geoEnv05: "belvedere-geo-env05",
  repBs02: "belvedere-rep-bs02",
  repBs04: "belvedere-rep-bs04",
  repBs05: "belvedere-rep-bs05",
} as const;

const CATEGORY_CODE: Record<string, string> = {
  governance: "1_governance",
  "cyber-digital": "2_cybersecurity",
  "physical-security": "3_physical",
  insurance: "4_insurance",
  "geographic-environmental": "5_geographic",
  "reputational-social": "6_reputational",
};

function row(
  id: string,
  riskAreaId: string,
  questionText: string,
  answerType: string,
  extra: Partial<PillarQuestionWithHierarchy> = {}
): PillarQuestionWithHierarchy {
  const code = CATEGORY_CODE[riskAreaId] ?? riskAreaId;
  return {
    id,
    sectionId: `sec-${riskAreaId}`,
    questionNumber: id,
    questionText,
    answerType,
    answer0: "None",
    answer1: "Informal",
    answer2: "Established",
    answer3: "Active + documented",
    whyThisMatters: "Risk relevance for tests.",
    recommendedActions: "Recommended remediation for tests.",
    isFollowUp: false,
    parentRef: null,
    displayOrder: 1,
    isVisible: true,
    section: {
      id: `sec-${riskAreaId}`,
      categoryId: `cat-${riskAreaId}`,
      code: "A",
      title: "Section A",
      displayOrder: 1,
      weightPct: 4,
      category: {
        id: `cat-${riskAreaId}`,
        code,
        kind: PillarCategoryKind.SCORING,
        displayOrder: 1,
        title: riskAreaId,
      },
    },
    ...extra,
  } as unknown as PillarQuestionWithHierarchy;
}

const BELVEDERE_ROWS: PillarQuestionWithHierarchy[] = [
  row(
    BELVEDERE_TEST_QUESTION_IDS.govA2,
    "governance",
    "Have you established a family governance structure?",
    "scored_0_3"
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.govA3,
    "governance",
    "Does the family hold regular governance meetings?",
    "scored_0_3",
    {
      answer0: "Never",
      answer1: "Inconsistent",
      answer2: "Regular",
      answer3: "Regular + agendas + minutes",
    }
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.govA4a,
    "governance",
    "Are the decision-making protocols documented?",
    "yes_no"
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.govA5,
    "governance",
    "Are external advisors engaged for family governance matters?",
    "scored_0_3",
    {
      answer0: "None",
      answer1: "Reactive",
      answer2: "Engaged",
      answer3: "Integrated governance advisors",
    }
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.govA6,
    "governance",
    "Are family conduct standards formally documented?",
    "scored_0_3"
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.govB1,
    "governance",
    "Are wills, trusts, and powers of attorney current?",
    "scored_0_3",
    {
      answer0: "None",
      answer1: "Outdated",
      answer2: "Current",
      answer3: "Current + multi-jurisdictional",
    }
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.govB4,
    "governance",
    "How are next-generation members trained for leadership?",
    "scored_0_3"
  ),
  row(BELVEDERE_TEST_QUESTION_IDS.physA1, "physical-security", "Physical security at residences", "scored_0_3"),
  row(
    BELVEDERE_TEST_QUESTION_IDS.physB2,
    "physical-security",
    "Staff vetting process",
    "scored_0_3",
    { answer0: "None", answer1: "Ad-hoc", answer2: "Formal", answer3: "Audited" }
  ),
  row(
    BELVEDERE_TEST_QUESTION_IDS.physE1,
    "physical-security",
    "Family emergency response plan",
    "scored_0_3",
    { answer0: "None", answer1: "Assumed", answer2: "Documented", answer3: "Enforced" }
  ),
  row(BELVEDERE_TEST_QUESTION_IDS.cyberA3, "cyber-digital", "Documented cyber policies", "yes_no"),
  row(BELVEDERE_TEST_QUESTION_IDS.cyberDh01, "cyber-digital", "Device hardening maturity", "scored_0_3"),
  row(BELVEDERE_TEST_QUESTION_IDS.insEnv04, "insurance", "Property insurance currency", "scored_0_3"),
  row(BELVEDERE_TEST_QUESTION_IDS.insHealth04, "insurance", "Medical preparedness review cadence", "scored_0_3", {
    answer0: "Never",
    answer1: "Once",
    answer2: "Light",
    answer3: "Substantive",
  }),
  row(BELVEDERE_TEST_QUESTION_IDS.insMrr01, "insurance", "Prenuptial agreement practice", "scored_0_3", {
    answer0: "None",
    answer1: "Optional",
    answer2: "Expected",
    answer3: "Mandatory",
  }),
  row(BELVEDERE_TEST_QUESTION_IDS.insMrr03, "insurance", "Marital asset protection", "scored_0_3", {
    answer0: "None",
    answer1: "Partial",
    answer2: "Implemented",
    answer3: "Reviewed",
  }),
  row(BELVEDERE_TEST_QUESTION_IDS.geoEnv01, "geographic-environmental", "Regional hazard awareness", "scored_0_3"),
  row(BELVEDERE_TEST_QUESTION_IDS.geoEnv02, "geographic-environmental", "Evacuation and shelter plans", "scored_0_3", {
    answer0: "None",
    answer1: "Verbal",
    answer2: "Written partial",
    answer3: "Written current",
  }),
  row(BELVEDERE_TEST_QUESTION_IDS.geoEnv03, "geographic-environmental", "Emergency services proximity factor", "scored_0_3", {
    answer0: "Never",
    answer1: "Sometimes",
    answer2: "Usually",
    answer3: "Always",
  }),
  row(BELVEDERE_TEST_QUESTION_IDS.geoEnv04, "geographic-environmental", "Catastrophe insurance currency", "scored_0_3"),
  row(BELVEDERE_TEST_QUESTION_IDS.geoEnv05, "geographic-environmental", "Continuity approach for displacement", "yes_no"),
  row(BELVEDERE_TEST_QUESTION_IDS.repBs02, "reputational-social", "Consequences for policy violations", "scored_0_3"),
  row(BELVEDERE_TEST_QUESTION_IDS.repBs04, "reputational-social", "Public behavior and social media guidelines", "scored_0_3", {
    answer0: "None",
    answer1: "Informal",
    answer2: "Documented",
    answer3: "Enforced",
  }),
  row(BELVEDERE_TEST_QUESTION_IDS.repBs05, "reputational-social", "Crisis communication readiness", "scored_0_3", {
    answer0: "Avoided",
    answer1: "Reactive",
    answer2: "Planned",
    answer3: "Tested",
  }),
];

const belvedereQuestions = wireQuestionsToQuestions(
  BELVEDERE_ROWS.map((r) => pillarQuestionRowToWire(r))
);

export function belvedereQuestionsForPillar(pillarId: string): Question[] {
  return belvedereQuestions.filter((q) => q.subCategory === pillarId);
}

export const belvedereAllAssessmentQuestions: Question[] = belvedereQuestions;

/** Legacy combined pillar shape for full-worksheet scoring in tests. */
export const belvedereFamilyGovernancePillar: Pillar = {
  id: "family-governance",
  name: "Comprehensive Risk Assessment",
  slug: "family-governance",
  description: "Belvedere six-domain household risk assessment (test fixture).",
  estimatedMinutes: 32,
  subCategories: ASSESSMENT_PILLAR_IDS.map((id) => ({
    id,
    name: id,
    description: id,
    weight: 1,
    questionIds: belvedereQuestionsForPillar(id).map((q) => q.id),
  })),
};
