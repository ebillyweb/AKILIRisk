/**
 * Starter assessment questions for the four platform pillars added in v3.0.
 * Seeded into PillarCategory / PillarSection / PillarQuestion via seed:new-pillar-questions.
 *
 * One array entry == one section. Entries that share a `categoryCode` are
 * grouped under the same pillar category by the seeder (category is upserted
 * by code, sections by `categoryId + sectionCode`). Section ordering is by
 * `sectionCode` (A, B, C, D…) — keep codes alphabetical to control order.
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
  // ==========================================================================
  // 7 — Liquidity & Cash Management (slug: liquidity-cash)
  // ==========================================================================
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & Cash Management",
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
      {
        questionNumber: "7.4",
        questionText:
          "Is there a written liquidity policy that sets target reserve levels and defines who authorizes drawdowns?",
        whyThisMatters:
          "Without a policy, reserve decisions are ad hoc and reserves are quietly depleted for non-emergencies.",
        recommendedActions:
          "Document target ranges, permitted uses, and approval authority for the reserve.",
      },
    ],
  },
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & Cash Management",
    sheetName: "Liquidity",
    displayOrder: 7,
    slug: "liquidity-cash",
    sectionCode: "B",
    sectionName: "Credit & borrowing capacity",
    questions: [
      {
        questionNumber: "7.5",
        questionText:
          "Are borrowing facilities diversified across more than one lender to avoid single-institution dependency?",
        whyThisMatters:
          "A single lender can cut or reprice credit at the worst moment, leaving no fallback.",
        recommendedActions:
          "Maintain relationships and standby capacity with at least two institutions.",
      },
      {
        questionNumber: "7.6",
        questionText:
          "Are pledged-asset and margin lending arrangements monitored against collateral-value trigger points?",
        whyThisMatters:
          "A market drop can force a margin call or collateral top-up precisely when liquidity is scarcest.",
        recommendedActions:
          "Track loan-to-value headroom and set alerts well above the maintenance threshold.",
      },
      {
        questionNumber: "7.7",
        questionText:
          "Is total household leverage measured against a defined debt-to-liquid-assets ceiling?",
        whyThisMatters:
          "Leverage that looks modest against net worth can be extreme against truly liquid assets.",
        recommendedActions:
          "Set and monitor a maximum leverage ratio expressed against liquid assets.",
      },
    ],
  },
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & Cash Management",
    sheetName: "Liquidity",
    displayOrder: 7,
    slug: "liquidity-cash",
    sectionCode: "C",
    sectionName: "Concentration & illiquid holdings",
    questions: [
      {
        questionNumber: "7.8",
        questionText:
          "Is exposure to any single illiquid asset (operating business, real estate, private fund) capped by policy?",
        whyThisMatters:
          "Over-concentration in one illiquid asset ties household stability to a single outcome.",
        recommendedActions:
          "Define concentration limits and a diversification plan for outsized positions.",
      },
      {
        questionNumber: "7.9",
        questionText:
          "Are capital-call obligations from private investments forecast and pre-funded?",
        whyThisMatters:
          "Unfunded capital calls can force distressed sales or default on commitments.",
        recommendedActions:
          "Maintain a rolling capital-call calendar and earmark liquidity to meet it.",
      },
      {
        questionNumber: "7.10",
        questionText:
          "Is a current schedule of lock-ups, gates, and redemption windows maintained across illiquid holdings?",
        whyThisMatters:
          "Assumed liquidity often disappears behind lock-ups and gates when it is actually needed.",
        recommendedActions:
          "Catalog redemption terms per holding and factor them into liquidity planning.",
      },
    ],
  },
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & Cash Management",
    sheetName: "Liquidity",
    displayOrder: 7,
    slug: "liquidity-cash",
    sectionCode: "D",
    sectionName: "Cash flow & obligations",
    questions: [
      {
        questionNumber: "7.11",
        questionText:
          "Are recurring large obligations (taxes, tuition, philanthropy, debt service) mapped on a forward cash-flow calendar?",
        whyThisMatters:
          "Predictable large outflows still cause shortfalls when they are not planned for in advance.",
        recommendedActions:
          "Build a 12-month cash-flow calendar and reconcile it quarterly.",
      },
      {
        questionNumber: "7.12",
        questionText:
          "Is a liquidity contingency plan documented for a sudden loss of income or a sharp market drawdown?",
        whyThisMatters:
          "Improvised responses to a shock usually lock in losses and erode long-term wealth.",
        recommendedActions:
          "Pre-decide which levers to pull, and in what order, before a shock occurs.",
      },
      {
        questionNumber: "7.13",
        questionText:
          "Are cash balances swept and structured to avoid idle, uninsured, or under-yielding deposits?",
        whyThisMatters:
          "Large idle balances lose value to inflation and can exceed deposit-insurance protection.",
        recommendedActions:
          "Automate sweeps and spread deposits to optimize yield and insured coverage.",
      },
      {
        questionNumber: "7.14",
        questionText:
          "Is there a named backup signer or authority who can access cash if the primary principal is incapacitated?",
        whyThisMatters:
          "Accounts controlled by one person can become frozen and inaccessible during an emergency.",
        recommendedActions:
          "Add trusted co-signers or powers of attorney with tested account access.",
      },
      {
        questionNumber: "7.15",
        questionText:
          "Is reserve and cash-flow adequacy reviewed at least annually and updated for lifestyle or family changes?",
        whyThisMatters:
          "Liquidity needs drift as spending, family size, and obligations change over time.",
        recommendedActions:
          "Schedule an annual liquidity review tied to the broader financial plan.",
      },
    ],
  },

  // ==========================================================================
  // 8 — Tax Exposure (slug: tax-exposure)
  // ==========================================================================
  {
    categoryCode: "8_tax",
    categoryName: "Tax Exposure",
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
      {
        questionNumber: "8.4",
        questionText:
          "Is there a coordinated annual tax-planning cycle among the CPA, attorney, and investment advisor?",
        whyThisMatters:
          "Advisors working in silos leave planning gaps and duplicate or conflicting strategies.",
        recommendedActions:
          "Convene an annual joint planning session with all tax-relevant advisors.",
      },
      {
        questionNumber: "8.5",
        questionText:
          "Are current-year and projected tax liabilities pre-funded to avoid liquidity strain at filing or payment deadlines?",
        whyThisMatters:
          "Underestimated liabilities force asset sales or penalties when payments come due.",
        recommendedActions:
          "Reserve for estimated taxes and reconcile projections each quarter.",
      },
    ],
  },
  {
    categoryCode: "8_tax",
    categoryName: "Tax Exposure",
    sheetName: "Tax",
    displayOrder: 8,
    slug: "tax-exposure",
    sectionCode: "B",
    sectionName: "Residency & jurisdiction",
    questions: [
      {
        questionNumber: "8.6",
        questionText:
          "Are state and international residency day-counts tracked to avoid unintended tax residency?",
        whyThisMatters:
          "Crossing a day-count threshold can create residency and taxation in a jurisdiction unexpectedly.",
        recommendedActions:
          "Log travel days and review residency status before year-end.",
      },
      {
        questionNumber: "8.7",
        questionText:
          "Is exposure to multi-state or cross-border income (property, business, wages) reviewed for double taxation?",
        whyThisMatters:
          "Income sourced across jurisdictions can be taxed twice without proper credits and structuring.",
        recommendedActions:
          "Map income sources to jurisdictions and confirm available credits with counsel.",
      },
      {
        questionNumber: "8.8",
        questionText:
          "Are foreign accounts and assets compliant with all applicable reporting obligations (e.g., FBAR, FATCA)?",
        whyThisMatters:
          "Foreign-asset reporting failures carry severe penalties even when no tax is owed.",
        recommendedActions:
          "Inventory foreign holdings and confirm every required disclosure is filed.",
      },
    ],
  },
  {
    categoryCode: "8_tax",
    categoryName: "Tax Exposure",
    sheetName: "Tax",
    displayOrder: 8,
    slug: "tax-exposure",
    sectionCode: "C",
    sectionName: "Structure & entity efficiency",
    questions: [
      {
        questionNumber: "8.9",
        questionText:
          "Are entity and trust structures reviewed for tax efficiency after significant legislative changes?",
        whyThisMatters:
          "Structures built under old law can become inefficient or exposed when tax law shifts.",
        recommendedActions:
          "Reassess entities and trusts whenever material tax legislation is enacted.",
      },
      {
        questionNumber: "8.10",
        questionText:
          "Is charitable giving structured (donor-advised fund, charitable trust, foundation) to optimize deductions and legacy goals?",
        whyThisMatters:
          "Unstructured giving forfeits deductions and misses opportunities to advance legacy aims.",
        recommendedActions:
          "Match giving vehicles to income, appreciation, and philanthropic objectives.",
      },
      {
        questionNumber: "8.11",
        questionText:
          "Are investment accounts managed for tax efficiency (asset location, loss harvesting, gain deferral)?",
        whyThisMatters:
          "Tax-inefficient investing quietly erodes after-tax returns year after year.",
        recommendedActions:
          "Apply asset-location and loss-harvesting discipline across accounts.",
      },
      {
        questionNumber: "8.12",
        questionText:
          "Are gifting and generation-skipping allowances used deliberately within annual and lifetime limits?",
        whyThisMatters:
          "Unused annual and lifetime exemptions are lost and increase future transfer-tax exposure.",
        recommendedActions:
          "Plan gifting annually to use exemptions before they lapse or laws change.",
      },
    ],
  },
  {
    categoryCode: "8_tax",
    categoryName: "Tax Exposure",
    sheetName: "Tax",
    displayOrder: 8,
    slug: "tax-exposure",
    sectionCode: "D",
    sectionName: "Compliance & audit readiness",
    questions: [
      {
        questionNumber: "8.13",
        questionText:
          "Are tax returns filed on time, with documented extensions and estimated-payment tracking?",
        whyThisMatters:
          "Late or incomplete filings generate penalties, interest, and heightened audit risk.",
        recommendedActions:
          "Maintain a filing calendar covering all entities, trusts, and jurisdictions.",
      },
      {
        questionNumber: "8.14",
        questionText:
          "Is supporting documentation organized and retained so filings can withstand an audit?",
        whyThisMatters:
          "Missing records turn a routine audit into an expensive, adverse outcome.",
        recommendedActions:
          "Keep organized, retention-compliant records for every material position.",
      },
      {
        questionNumber: "8.15",
        questionText:
          "Is there a defined process and named advisor for responding to tax-authority notices or audits?",
        whyThisMatters:
          "Delayed or uncoordinated responses to notices escalate disputes and penalties.",
        recommendedActions:
          "Pre-designate who handles notices and how they are triaged and answered.",
      },
    ],
  },

  // ==========================================================================
  // 9 — Estate & Succession (slug: estate-succession)
  // ==========================================================================
  {
    categoryCode: "9_estate",
    categoryName: "Estate & Succession",
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
      {
        questionNumber: "9.4",
        questionText:
          "Are healthcare directives and HIPAA authorizations in place and shared with the designated agents?",
        whyThisMatters:
          "Without directives, medical decisions stall and agents are denied information in a crisis.",
        recommendedActions:
          "Execute advance directives and distribute them to agents and providers.",
      },
      {
        questionNumber: "9.5",
        questionText:
          "Is estate liquidity sufficient to cover taxes and settlement costs without forced asset sales?",
        whyThisMatters:
          "Illiquid estates can force heirs to sell prized assets under time pressure to pay taxes.",
        recommendedActions:
          "Model settlement costs and earmark or insure liquidity to cover them.",
      },
    ],
  },
  {
    categoryCode: "9_estate",
    categoryName: "Estate & Succession",
    sheetName: "Estate",
    displayOrder: 9,
    slug: "estate-succession",
    sectionCode: "B",
    sectionName: "Trust & transfer structures",
    questions: [
      {
        questionNumber: "9.6",
        questionText:
          "Are trusts properly funded, with the intended assets actually retitled into them?",
        whyThisMatters:
          "An unfunded trust is an empty shell that fails to achieve its protection or tax goals.",
        recommendedActions:
          "Verify titling and confirm each trust holds the assets it was designed for.",
      },
      {
        questionNumber: "9.7",
        questionText:
          "Are trustees and successor trustees named, qualified, and aware of their duties?",
        whyThisMatters:
          "Unprepared or missing trustees create governance gaps and disputes after a death.",
        recommendedActions:
          "Confirm successor trustees and brief them on their responsibilities.",
      },
      {
        questionNumber: "9.8",
        questionText:
          "Is the estate plan reviewed after major life, tax-law, or significant asset changes?",
        whyThisMatters:
          "Plans drift out of alignment with reality as families, laws, and assets change.",
        recommendedActions:
          "Schedule periodic reviews and re-review after any triggering event.",
      },
    ],
  },
  {
    categoryCode: "9_estate",
    categoryName: "Estate & Succession",
    sheetName: "Estate",
    displayOrder: 9,
    slug: "estate-succession",
    sectionCode: "C",
    sectionName: "Beneficiary alignment & communication",
    questions: [
      {
        questionNumber: "9.9",
        questionText:
          "Have inheritance intentions and fiduciary roles been communicated to heirs to reduce future disputes?",
        whyThisMatters:
          "Surprises in an estate plan are a leading cause of family conflict and litigation.",
        recommendedActions:
          "Hold structured conversations to set expectations while the principals can explain them.",
      },
      {
        questionNumber: "9.10",
        questionText:
          "Is there a plan for equitable treatment of heirs, including any illiquid or operating assets?",
        whyThisMatters:
          "Dividing illiquid assets unequally or unclearly breeds resentment and forced sales.",
        recommendedActions:
          "Design equalization strategies (insurance, buyouts, or tailored bequests).",
      },
      {
        questionNumber: "9.11",
        questionText:
          "Are guardianship provisions for any minor children documented and current?",
        whyThisMatters:
          "Without valid guardianship provisions, a court decides who raises minor children.",
        recommendedActions:
          "Name guardians and successors, and revisit the choice as circumstances change.",
      },
      {
        questionNumber: "9.12",
        questionText:
          "Are philanthropic and legacy intentions documented and integrated into the estate plan?",
        whyThisMatters:
          "Undocumented charitable intent is often lost or contested after death.",
        recommendedActions:
          "Formalize legacy goals in the plan and align giving vehicles to them.",
      },
    ],
  },
  {
    categoryCode: "9_estate",
    categoryName: "Estate & Succession",
    sheetName: "Estate",
    displayOrder: 9,
    slug: "estate-succession",
    sectionCode: "D",
    sectionName: "Business & digital succession",
    questions: [
      {
        questionNumber: "9.13",
        questionText:
          "Is a buy-sell agreement in place and funded for any closely held business interests?",
        whyThisMatters:
          "Without a funded buy-sell, an owner's death can trigger disputes or a fire-sale of the business.",
        recommendedActions:
          "Execute and fund a buy-sell agreement with a current valuation method.",
      },
      {
        questionNumber: "9.14",
        questionText:
          "Is access to digital assets, accounts, and passwords documented for fiduciaries?",
        whyThisMatters:
          "Locked digital accounts can strand assets and disrupt operations after incapacity or death.",
        recommendedActions:
          "Maintain a secure, updated digital-access directory with legal authority to use it.",
      },
      {
        questionNumber: "9.15",
        questionText:
          "Is a consolidated inventory of assets, liabilities, and advisors maintained for executors?",
        whyThisMatters:
          "Executors waste months and money reconstructing an estate that was never inventoried.",
        recommendedActions:
          "Keep a current master inventory and share its location with fiduciaries.",
      },
    ],
  },

  // ==========================================================================
  // 10 — Behavioral Resilience (slug: family-governance-behavioral)
  // ==========================================================================
  {
    categoryCode: "10_family_governance",
    categoryName: "Behavioral Resilience",
    sheetName: "Behavioral Resilience",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "A",
    sectionName: "Family dynamics & communication",
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
      {
        questionNumber: "10.4",
        questionText:
          "Are there agreed norms for surfacing and resolving family conflict before it escalates?",
        whyThisMatters:
          "Unmanaged conflict fractures families and destabilizes shared assets and decisions.",
        recommendedActions:
          "Adopt a conflict-resolution process, including neutral facilitation when needed.",
      },
      {
        questionNumber: "10.5",
        questionText:
          "Is professional facilitation or family-therapy support available for sensitive transitions?",
        whyThisMatters:
          "Major transitions (succession, death, divorce) overwhelm families without skilled support.",
        recommendedActions:
          "Identify facilitators or advisors to engage before high-stress transitions.",
      },
    ],
  },
  {
    categoryCode: "10_family_governance",
    categoryName: "Behavioral Resilience",
    sheetName: "Behavioral Resilience",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "B",
    sectionName: "Heir preparedness & financial literacy",
    questions: [
      {
        questionNumber: "10.6",
        questionText:
          "Do rising-generation members receive structured financial education appropriate to their age and role?",
        whyThisMatters:
          "Heirs who never learn to steward wealth are the primary reason wealth fails to transfer.",
        recommendedActions:
          "Build an age-appropriate financial-education path for each rising family member.",
      },
      {
        questionNumber: "10.7",
        questionText:
          "Are heirs given graduated responsibility and mentorship before inheriting significant wealth?",
        whyThisMatters:
          "Sudden, unprepared inheritance frequently leads to poor decisions and rapid loss.",
        recommendedActions:
          "Introduce responsibility in stages with mentorship and defined milestones.",
      },
      {
        questionNumber: "10.8",
        questionText:
          "Is there a shared understanding of the family's values, purpose, and expectations around wealth?",
        whyThisMatters:
          "Without shared purpose, wealth becomes a source of division rather than cohesion.",
        recommendedActions:
          "Articulate a family mission or values statement and revisit it together.",
      },
      {
        questionNumber: "10.9",
        questionText:
          "Is next-generation involvement in governance and philanthropy actively cultivated?",
        whyThisMatters:
          "Heirs excluded from governance disengage and are unprepared to lead when the time comes.",
        recommendedActions:
          "Give the rising generation real roles in family governance and giving.",
      },
    ],
  },
  {
    categoryCode: "10_family_governance",
    categoryName: "Behavioral Resilience",
    sheetName: "Behavioral Resilience",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "C",
    sectionName: "Decision-making under stress",
    questions: [
      {
        questionNumber: "10.10",
        questionText:
          "Is there a documented protocol for making major decisions during a crisis or loss of a principal?",
        whyThisMatters:
          "Decisions made in shock, without a protocol, are frequently regretted and costly.",
        recommendedActions:
          "Pre-define who decides what, and how, when a principal is unavailable.",
      },
      {
        questionNumber: "10.11",
        questionText:
          "Are major decisions subject to a cooling-off period or a second-opinion requirement?",
        whyThisMatters:
          "Urgency and pressure tactics drive impulsive commitments that a pause would prevent.",
        recommendedActions:
          "Require a waiting period and independent review above a decision threshold.",
      },
      {
        questionNumber: "10.12",
        questionText:
          "Has the family rehearsed or scenario-planned for emergencies (incapacity, death, reputational event)?",
        whyThisMatters:
          "Families that have never rehearsed a crisis improvise badly when one arrives.",
        recommendedActions:
          "Run periodic tabletop exercises for the most consequential scenarios.",
      },
    ],
  },
  {
    categoryCode: "10_family_governance",
    categoryName: "Behavioral Resilience",
    sheetName: "Behavioral Resilience",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "D",
    sectionName: "Behavioral-finance discipline",
    questions: [
      {
        questionNumber: "10.13",
        questionText:
          "Is there a written investment policy that constrains impulsive or emotionally driven decisions?",
        whyThisMatters:
          "A policy set in calm conditions is the best defense against panic and euphoria.",
        recommendedActions:
          "Adopt an investment policy statement and hold decisions accountable to it.",
      },
      {
        questionNumber: "10.14",
        questionText:
          "Are new investment opportunities screened against a checklist before capital is committed?",
        whyThisMatters:
          "Deals presented as once-in-a-lifetime bypass diligence and concentrate hidden risk.",
        recommendedActions:
          "Require every opportunity to pass a standard diligence checklist first.",
      },
      {
        questionNumber: "10.15",
        questionText:
          "Is susceptibility to affinity fraud and unsolicited pitches actively guarded against?",
        whyThisMatters:
          "Wealthy families are prime targets for fraud that exploits trust and social ties.",
        recommendedActions:
          "Route unsolicited offers through advisors and verify counterparties independently.",
      },
    ],
  },
];

export { SCORED_0_3 };
