/**
 * Starter assessment questions for the four platform pillars added in v3.0.
 * Seeded into PillarCategory / PillarSection / PillarQuestion via seed:new-pillar-questions.
 */

export type NewPillarQuestionStarter = {
  questionNumber: string;
  questionText: string;
  whyThisMatters: string;
  recommendedActions: string;
};

export type NewPillarAssessmentStarter = {
  categoryCode: string;
  categoryName: string;
  sheetName: string;
  displayOrder: number;
  slug: string;
  sectionCode: string;
  sectionName: string;
  questions: NewPillarQuestionStarter[];
};

const SCORED_0_3 = {
  answerType: "scored_0_3" as const,
  scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
};

export const NEW_PILLAR_ASSESSMENT_STARTERS: NewPillarAssessmentStarter[] = [
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & cash management",
    sheetName: "Liquidity",
    displayOrder: 7,
    slug: "liquidity-cash",
    sectionCode: "A",
    sectionName: "Liquidity posture",
    questions: [
      {
        questionNumber: "7.1",
        questionText:
          "Does the household maintain documented emergency liquidity equal to at least six months of core operating expenses?",
        whyThisMatters:
          "Unexpected obligations and market dislocations require ready cash without forced asset sales.",
        recommendedActions:
          "Establish a dedicated reserve account and document replenishment rules with your advisor.",
      },
      {
        questionNumber: "7.2",
        questionText:
          "Are committed lines of credit documented, annually reviewed, and tested for availability under stress?",
        whyThisMatters:
          "Credit capacity is part of liquidity — unused lines can fail when needed most.",
        recommendedActions:
          "Confirm covenants, maturity dates, and draw procedures with your banking team.",
      },
      {
        questionNumber: "7.3",
        questionText:
          "Is illiquid wealth concentration stress-tested against near-term capital calls and tax obligations?",
        whyThisMatters:
          "Concentrated private holdings can create liquidity cliffs even when net worth appears strong.",
        recommendedActions:
          "Model liquidity gaps across 12-, 24-, and 36-month horizons.",
      },
    ],
  },
  {
    categoryCode: "8_tax",
    categoryName: "Tax exposure",
    sheetName: "Tax",
    displayOrder: 8,
    slug: "tax-exposure",
    sectionCode: "A",
    sectionName: "Tax posture",
    questions: [
      {
        questionNumber: "8.1",
        questionText:
          "Is the household's tax residency posture documented and reviewed annually with qualified counsel?",
        whyThisMatters:
          "Residency changes can trigger unexpected filing and withholding obligations.",
        recommendedActions:
          "Maintain a residency dossier and coordinate with investment and estate advisors.",
      },
      {
        questionNumber: "8.2",
        questionText:
          "Are compensation, deferral, and equity-compensation tax impacts modeled before major liquidity events?",
        whyThisMatters:
          "Large cash events often carry AMT, NIIT, or state-tax surprises without proactive modeling.",
        recommendedActions:
          "Run scenario models before exercising options or selling concentrated positions.",
      },
      {
        questionNumber: "8.3",
        questionText:
          "Is estate-tax exposure mapped across entities, trusts, and beneficiary designations?",
        whyThisMatters:
          "Misaligned documents can increase transfer-tax exposure despite prior planning.",
        recommendedActions:
          "Reconcile entity charts, beneficiary forms, and trust funding annually.",
      },
    ],
  },
  {
    categoryCode: "9_estate",
    categoryName: "Estate & succession",
    sheetName: "Estate",
    displayOrder: 9,
    slug: "estate-succession",
    sectionCode: "A",
    sectionName: "Estate readiness",
    questions: [
      {
        questionNumber: "9.1",
        questionText:
          "Are wills, trusts, and powers of attorney current, signed, and stored where fiduciaries can access them?",
        whyThisMatters:
          "Stale or inaccessible documents delay authority during incapacity or death.",
        recommendedActions:
          "Confirm document dates, successor fiduciaries, and secure storage locations.",
      },
      {
        questionNumber: "9.2",
        questionText:
          "Are beneficiary designations aligned across retirement accounts, insurance, and transfer-on-death registrations?",
        whyThisMatters:
          "Beneficiary forms override wills and are a common source of unintended transfers.",
        recommendedActions:
          "Audit all beneficiary designations after major life events.",
      },
      {
        questionNumber: "9.3",
        questionText:
          "Is there a documented business or family-enterprise succession protocol for key principals?",
        whyThisMatters:
          "Operating businesses fail transitions without clear decision rights and contingency plans.",
        recommendedActions:
          "Document succession triggers, voting control, and interim leadership authority.",
      },
    ],
  },
  {
    categoryCode: "10_family_governance",
    categoryName: "Family governance & behavioral resilience",
    sheetName: "Family governance",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "A",
    sectionName: "Family governance",
    questions: [
      {
        questionNumber: "10.1",
        questionText:
          "Does the family hold structured meetings to review wealth decisions, education, and shared values?",
        whyThisMatters:
          "Governance forums reduce ad-hoc conflict and improve next-generation preparedness.",
        recommendedActions:
          "Schedule quarterly family meetings with a documented agenda and decision log.",
      },
      {
        questionNumber: "10.2",
        questionText:
          "Are decision rights and spending authorities documented for spouses, children, and trusted advisors?",
        whyThisMatters:
          "Ambiguous authority creates delays, duplicate actions, and interpersonal friction.",
        recommendedActions:
          "Publish a decision-rights matrix and review it when family structure changes.",
      },
      {
        questionNumber: "10.3",
        questionText:
          "Are behavioral-finance pitfalls (concentration, urgency, social proof) discussed before major investments?",
        whyThisMatters:
          "Wealth families are vulnerable to emotionally driven decisions that compound risk.",
        recommendedActions:
          "Adopt a pre-commitment checklist for investments above a defined threshold.",
      },
    ],
  },
];

export { SCORED_0_3 };
