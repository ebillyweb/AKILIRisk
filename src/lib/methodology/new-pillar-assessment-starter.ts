/**
 * Starter assessment questions for the four platform pillars added in v3.0.
 * Seeded into PillarCategory / PillarSection / PillarQuestion via seed:new-pillar-questions.
 *
 * One array entry == one section. Entries that share a `categoryCode` are
 * grouped under the same pillar category by the seeder (category is upserted
 * by code, sections by `categoryId + sectionCode`). Section ordering is by
 * `sectionCode` (A, B, C, D…) — keep codes alphabetical to control order.
 *
 * Full pillar depth: each of the four pillars has six sections (A–F) of five
 * scored questions each (30 per pillar). Question numbers 7.1-7.3, 8.1-8.3,
 * 9.1-9.3, 10.1-10.3 are the original v3.0 starters and MUST keep their exact
 * text/number so re-seeding stays idempotent against already-seeded rows.
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
    sectionName: "Liquidity posture & reserves",
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
      {
        questionNumber: "7.5",
        questionText:
          "Is reserve adequacy reviewed at least annually and updated for lifestyle, family, or obligation changes?",
        whyThisMatters:
          "Liquidity needs drift as spending, family size, and commitments change over time.",
        recommendedActions:
          "Schedule an annual liquidity review tied to the broader financial plan.",
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
        questionNumber: "7.6",
        questionText:
          "Are borrowing facilities diversified across more than one lender to avoid single-institution dependency?",
        whyThisMatters:
          "A single lender can cut or reprice credit at the worst moment, leaving no fallback.",
        recommendedActions:
          "Maintain relationships and standby capacity with at least two institutions.",
      },
      {
        questionNumber: "7.7",
        questionText:
          "Are pledged-asset and margin lending arrangements monitored against collateral-value trigger points?",
        whyThisMatters:
          "A market drop can force a margin call or collateral top-up precisely when liquidity is scarcest.",
        recommendedActions:
          "Track loan-to-value headroom and set alerts well above the maintenance threshold.",
      },
      {
        questionNumber: "7.8",
        questionText:
          "Is total household leverage measured against a defined debt-to-liquid-assets ceiling?",
        whyThisMatters:
          "Leverage that looks modest against net worth can be extreme against truly liquid assets.",
        recommendedActions:
          "Set and monitor a maximum leverage ratio expressed against liquid assets.",
      },
      {
        questionNumber: "7.9",
        questionText:
          "Are loan covenants, maturities, and refinancing timelines tracked to avoid forced refinancing in poor conditions?",
        whyThisMatters:
          "Maturities that cluster or fall in a bad market force costly refinancing or asset sales.",
        recommendedActions:
          "Maintain a debt-maturity ladder and refinance proactively before deadlines.",
      },
      {
        questionNumber: "7.10",
        questionText:
          "Is interest-rate exposure on variable-rate debt understood and hedged where appropriate?",
        whyThisMatters:
          "Rising rates can sharply increase debt service and strain household cash flow.",
        recommendedActions:
          "Model rate scenarios and consider fixing or hedging material exposures.",
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
        questionNumber: "7.11",
        questionText:
          "Is exposure to any single illiquid asset (operating business, real estate, private fund) capped by policy?",
        whyThisMatters:
          "Over-concentration in one illiquid asset ties household stability to a single outcome.",
        recommendedActions:
          "Define concentration limits and a diversification plan for outsized positions.",
      },
      {
        questionNumber: "7.12",
        questionText:
          "Are capital-call obligations from private investments forecast and pre-funded?",
        whyThisMatters:
          "Unfunded capital calls can force distressed sales or default on commitments.",
        recommendedActions:
          "Maintain a rolling capital-call calendar and earmark liquidity to meet it.",
      },
      {
        questionNumber: "7.13",
        questionText:
          "Is a current schedule of lock-ups, gates, and redemption windows maintained across illiquid holdings?",
        whyThisMatters:
          "Assumed liquidity often disappears behind lock-ups and gates when it is actually needed.",
        recommendedActions:
          "Catalog redemption terms per holding and factor them into liquidity planning.",
      },
      {
        questionNumber: "7.14",
        questionText:
          "Are private and concentrated holdings valued and reviewed on a regular schedule?",
        whyThisMatters:
          "Stale valuations mask concentration risk and mislead liquidity and estate planning.",
        recommendedActions:
          "Obtain periodic valuations for material illiquid positions.",
      },
      {
        questionNumber: "7.15",
        questionText:
          "Is there a diversification or monetization plan for a dominant concentrated position (e.g., founder stock)?",
        whyThisMatters:
          "Wealth anchored to one security is exposed to a single company's fate.",
        recommendedActions:
          "Use staged selling, hedging, or exchange strategies to reduce concentration.",
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
        questionNumber: "7.16",
        questionText:
          "Are recurring large obligations (taxes, tuition, philanthropy, debt service) mapped on a forward cash-flow calendar?",
        whyThisMatters:
          "Predictable large outflows still cause shortfalls when they are not planned for in advance.",
        recommendedActions:
          "Build a 12-month cash-flow calendar and reconcile it quarterly.",
      },
      {
        questionNumber: "7.17",
        questionText:
          "Is a liquidity contingency plan documented for a sudden loss of income or a sharp market drawdown?",
        whyThisMatters:
          "Improvised responses to a shock usually lock in losses and erode long-term wealth.",
        recommendedActions:
          "Pre-decide which levers to pull, and in what order, before a shock occurs.",
      },
      {
        questionNumber: "7.18",
        questionText:
          "Are cash balances swept and structured to avoid idle, uninsured, or under-yielding deposits?",
        whyThisMatters:
          "Large idle balances lose value to inflation and can exceed deposit-insurance protection.",
        recommendedActions:
          "Automate sweeps and spread deposits to optimize yield and insured coverage.",
      },
      {
        questionNumber: "7.19",
        questionText:
          "Are large or irregular expenses (major purchases, renovations, events) planned and pre-funded?",
        whyThisMatters:
          "Lumpy discretionary spending can quietly drain reserves without a plan.",
        recommendedActions:
          "Budget and pre-fund known large expenditures ahead of time.",
      },
      {
        questionNumber: "7.20",
        questionText:
          "Is household spending tracked against a defined budget or spending policy?",
        whyThisMatters:
          "Lifestyle creep erodes liquidity and long-term financial sustainability.",
        recommendedActions:
          "Adopt a spending policy and monitor actual spending against it.",
      },
    ],
  },
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & Cash Management",
    sheetName: "Liquidity",
    displayOrder: 7,
    slug: "liquidity-cash",
    sectionCode: "E",
    sectionName: "Banking & counterparty resilience",
    questions: [
      {
        questionNumber: "7.21",
        questionText:
          "Are deposits and cash equivalents spread across institutions to stay within insured limits and reduce counterparty risk?",
        whyThisMatters:
          "Concentrated deposits can exceed insurance and expose cash to a single bank failure.",
        recommendedActions:
          "Diversify custodians and use insured-sweep programs for large balances.",
      },
      {
        questionNumber: "7.22",
        questionText:
          "Is the credit quality of banks, custodians, and money-market holdings periodically reviewed?",
        whyThisMatters:
          "Even large institutions can fail or freeze access to funds.",
        recommendedActions:
          "Monitor counterparty ratings and diversify custody arrangements.",
      },
      {
        questionNumber: "7.23",
        questionText:
          "Are wire-transfer and payment controls in place to prevent fraud on large cash movements?",
        whyThisMatters:
          "Large transfers are prime targets for fraud, interception, and error.",
        recommendedActions:
          "Require call-back verification and dual approval for material wires.",
      },
      {
        questionNumber: "7.24",
        questionText:
          "Is there redundancy in banking access (multiple institutions, backup payment methods) for continuity?",
        whyThisMatters:
          "A single frozen or compromised account can halt payments entirely.",
        recommendedActions:
          "Maintain backup accounts and alternate payment channels.",
      },
      {
        questionNumber: "7.25",
        questionText:
          "Are foreign-currency and cross-border cash needs planned to avoid unfavorable conversions or access delays?",
        whyThisMatters:
          "Currency timing and cross-border frictions can be costly when liquidity is urgent.",
        recommendedActions:
          "Pre-position currency and confirm cross-border access in advance.",
      },
    ],
  },
  {
    categoryCode: "7_liquidity",
    categoryName: "Liquidity & Cash Management",
    sheetName: "Liquidity",
    displayOrder: 7,
    slug: "liquidity-cash",
    sectionCode: "F",
    sectionName: "Governance, monitoring & contingency",
    questions: [
      {
        questionNumber: "7.26",
        questionText:
          "Is there a named backup signer or authority who can access cash if the primary principal is incapacitated?",
        whyThisMatters:
          "Accounts controlled by one person can become frozen and inaccessible during an emergency.",
        recommendedActions:
          "Add trusted co-signers or powers of attorney with tested account access.",
      },
      {
        questionNumber: "7.27",
        questionText:
          "Is liquidity reporting consolidated across accounts and institutions into a single view?",
        whyThisMatters:
          "Fragmented reporting hides the household's true available liquidity.",
        recommendedActions:
          "Consolidate reporting into one regularly updated dashboard.",
      },
      {
        questionNumber: "7.28",
        questionText:
          "Are liquidity metrics reviewed with advisors on a set cadence with clear thresholds and alerts?",
        whyThisMatters:
          "Without cadence and thresholds, liquidity problems surface too late to manage well.",
        recommendedActions:
          "Set review cadence and trigger levels with your advisory team.",
      },
      {
        questionNumber: "7.29",
        questionText:
          "Has the household stress-tested liquidity against a severe combined scenario (market drop, income loss, capital call)?",
        whyThisMatters:
          "Individual shocks are survivable; simultaneous shocks are what break plans.",
        recommendedActions:
          "Run a combined-shock liquidity stress test at least annually.",
      },
      {
        questionNumber: "7.30",
        questionText:
          "Is documentation of accounts, facilities, and access instructions maintained for advisors and fiduciaries?",
        whyThisMatters:
          "Undocumented access strands liquidity when principals are unavailable.",
        recommendedActions:
          "Keep a secure, current directory of accounts, facilities, and access.",
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
    sectionName: "Tax governance & advisory",
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
      {
        questionNumber: "8.9",
        questionText:
          "Are the tax implications of relocation or a new residence modeled before the move?",
        whyThisMatters:
          "Moves can trigger exit taxes, changed source-income rules, and other surprises.",
        recommendedActions:
          "Model the full tax impact before establishing a new residence.",
      },
      {
        questionNumber: "8.10",
        questionText:
          "Is exposure to local property, transfer, and wealth taxes across jurisdictions understood?",
        whyThisMatters:
          "Sub-national and foreign levies add up and are easily overlooked in planning.",
        recommendedActions:
          "Catalog jurisdiction-specific taxes on each property and asset.",
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
    sectionName: "Income & transaction planning",
    questions: [
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
          "Are the timing and structure of large transactions planned for tax impact (installment sales, 1031, QSBS)?",
        whyThisMatters:
          "Poorly timed or structured transactions forfeit large, avoidable tax savings.",
        recommendedActions:
          "Plan transaction structure and timing with counsel before closing.",
      },
      {
        questionNumber: "8.13",
        questionText:
          "Is AMT, NIIT, and surtax exposure projected before triggering events?",
        whyThisMatters:
          "These surtaxes ambush unprepared taxpayers in high-income years.",
        recommendedActions:
          "Project exposure and plan around the triggering thresholds.",
      },
      {
        questionNumber: "8.14",
        questionText:
          "Are equity-compensation decisions (exercise, vesting, 83(b) elections) evaluated for tax outcomes?",
        whyThisMatters:
          "The timing of option and RSU events drives large, avoidable tax bills.",
        recommendedActions:
          "Model each equity-compensation decision before acting.",
      },
      {
        questionNumber: "8.15",
        questionText:
          "Is estimated-tax and withholding accuracy monitored to avoid penalties and large true-ups?",
        whyThisMatters:
          "Under-withholding creates penalties and painful year-end surprises.",
        recommendedActions:
          "Review withholding and estimated payments each quarter.",
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
    sectionName: "Structure & entity efficiency",
    questions: [
      {
        questionNumber: "8.16",
        questionText:
          "Are entity and trust structures reviewed for tax efficiency after significant legislative changes?",
        whyThisMatters:
          "Structures built under old law can become inefficient or exposed when tax law shifts.",
        recommendedActions:
          "Reassess entities and trusts whenever material tax legislation is enacted.",
      },
      {
        questionNumber: "8.17",
        questionText:
          "Are pass-through and entity elections (S-corp, partnership, PTET) reviewed and optimized annually?",
        whyThisMatters:
          "Suboptimal elections leave money on the table every year.",
        recommendedActions:
          "Review elections annually with your CPA before deadlines.",
      },
      {
        questionNumber: "8.18",
        questionText:
          "Is the tax treatment of business income, distributions, and owner compensation defensible?",
        whyThisMatters:
          "Aggressive or careless positions invite audit, reclassification, and penalties.",
        recommendedActions:
          "Document and support entity-level tax positions.",
      },
      {
        questionNumber: "8.19",
        questionText:
          "Are intra-family and related-party transactions structured at arm's length and documented?",
        whyThisMatters:
          "Related-party dealings draw scrutiny and reclassification risk.",
        recommendedActions:
          "Document terms and valuations for all family transactions.",
      },
      {
        questionNumber: "8.20",
        questionText:
          "Are state-level entity and nexus obligations reviewed as the business or asset base expands?",
        whyThisMatters:
          "Growth silently creates new filing, registration, and nexus obligations.",
        recommendedActions:
          "Reassess nexus and registrations as the footprint grows.",
      },
    ],
  },
  {
    categoryCode: "8_tax",
    categoryName: "Tax Exposure",
    sheetName: "Tax",
    displayOrder: 8,
    slug: "tax-exposure",
    sectionCode: "E",
    sectionName: "Wealth transfer & charitable",
    questions: [
      {
        questionNumber: "8.21",
        questionText:
          "Are gifting and generation-skipping allowances used deliberately within annual and lifetime limits?",
        whyThisMatters:
          "Unused annual and lifetime exemptions are lost and increase future transfer-tax exposure.",
        recommendedActions:
          "Plan gifting annually to use exemptions before they lapse or laws change.",
      },
      {
        questionNumber: "8.22",
        questionText:
          "Is charitable giving structured (donor-advised fund, charitable trust, foundation) to optimize deductions and legacy goals?",
        whyThisMatters:
          "Unstructured giving forfeits deductions and misses opportunities to advance legacy aims.",
        recommendedActions:
          "Match giving vehicles to income, appreciation, and philanthropic objectives.",
      },
      {
        questionNumber: "8.23",
        questionText:
          "Are appreciated assets used for gifting and charitable giving to maximize tax efficiency?",
        whyThisMatters:
          "Gifting cash instead of appreciated assets wastes available tax benefits.",
        recommendedActions:
          "Prioritize appreciated-asset gifting where appropriate.",
      },
      {
        questionNumber: "8.24",
        questionText:
          "Is basis planning (step-up, carryover, gifting timing) coordinated with the estate plan?",
        whyThisMatters:
          "Ignoring basis can cost heirs more than the transfer-tax savings gained.",
        recommendedActions:
          "Coordinate basis strategy with estate counsel.",
      },
      {
        questionNumber: "8.25",
        questionText:
          "Are advanced transfer techniques (GRAT, SLAT, IDGT) evaluated where appropriate to the estate?",
        whyThisMatters:
          "Failing to use available techniques leaves transfer tax on the table.",
        recommendedActions:
          "Evaluate advanced strategies with estate and tax counsel.",
      },
    ],
  },
  {
    categoryCode: "8_tax",
    categoryName: "Tax Exposure",
    sheetName: "Tax",
    displayOrder: 8,
    slug: "tax-exposure",
    sectionCode: "F",
    sectionName: "Compliance & audit readiness",
    questions: [
      {
        questionNumber: "8.26",
        questionText:
          "Are tax returns filed on time, with documented extensions and estimated-payment tracking?",
        whyThisMatters:
          "Late or incomplete filings generate penalties, interest, and heightened audit risk.",
        recommendedActions:
          "Maintain a filing calendar covering all entities, trusts, and jurisdictions.",
      },
      {
        questionNumber: "8.27",
        questionText:
          "Is supporting documentation organized and retained so filings can withstand an audit?",
        whyThisMatters:
          "Missing records turn a routine audit into an expensive, adverse outcome.",
        recommendedActions:
          "Keep organized, retention-compliant records for every material position.",
      },
      {
        questionNumber: "8.28",
        questionText:
          "Is there a defined process and named advisor for responding to tax-authority notices or audits?",
        whyThisMatters:
          "Delayed or uncoordinated responses to notices escalate disputes and penalties.",
        recommendedActions:
          "Pre-designate who handles notices and how they are triaged and answered.",
      },
      {
        questionNumber: "8.29",
        questionText:
          "Are aggressive positions and their risk levels reviewed and understood before filing?",
        whyThisMatters:
          "Unassessed aggressive positions expose the family to penalties and disputes.",
        recommendedActions:
          "Assess and document the risk of each material position before filing.",
      },
      {
        questionNumber: "8.30",
        questionText:
          "Is a complete, current record of entities, trusts, and their filing obligations centrally maintained?",
        whyThisMatters:
          "Fragmented records cause missed filings and compliance gaps.",
        recommendedActions:
          "Maintain a central register of all entities and their obligations.",
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
    sectionName: "Foundational documents & readiness",
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
          "Are durable financial powers of attorney current and confirmed acceptable to key institutions?",
        whyThisMatters:
          "A rejected or stale power of attorney leaves no one able to act on financial matters.",
        recommendedActions:
          "Confirm institutions will honor the power of attorney and refresh it as needed.",
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
      {
        questionNumber: "9.9",
        questionText:
          "Are trust terms aligned with current family circumstances and intentions?",
        whyThisMatters:
          "Outdated trust terms can frustrate current goals and family realities.",
        recommendedActions:
          "Review and, where possible, modernize trust terms.",
      },
      {
        questionNumber: "9.10",
        questionText:
          "Is the choice between individual and corporate trustees evaluated for complex or long-term trusts?",
        whyThisMatters:
          "The wrong trustee structure creates conflict, mismanagement, or excessive cost.",
        recommendedActions:
          "Assess the trustee structure for each significant trust.",
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
        questionNumber: "9.11",
        questionText:
          "Have inheritance intentions and fiduciary roles been communicated to heirs to reduce future disputes?",
        whyThisMatters:
          "Surprises in an estate plan are a leading cause of family conflict and litigation.",
        recommendedActions:
          "Hold structured conversations to set expectations while the principals can explain them.",
      },
      {
        questionNumber: "9.12",
        questionText:
          "Is there a plan for equitable treatment of heirs, including any illiquid or operating assets?",
        whyThisMatters:
          "Dividing illiquid assets unequally or unclearly breeds resentment and forced sales.",
        recommendedActions:
          "Design equalization strategies (insurance, buyouts, or tailored bequests).",
      },
      {
        questionNumber: "9.13",
        questionText:
          "Are guardianship provisions for any minor children documented and current?",
        whyThisMatters:
          "Without valid guardianship provisions, a court decides who raises minor children.",
        recommendedActions:
          "Name guardians and successors, and revisit the choice as circumstances change.",
      },
      {
        questionNumber: "9.14",
        questionText:
          "Are provisions in place for beneficiaries with special needs or particular vulnerabilities?",
        whyThisMatters:
          "Direct inheritance can disqualify benefits or expose vulnerable heirs to harm.",
        recommendedActions:
          "Use special-needs trusts and protective structures where appropriate.",
      },
      {
        questionNumber: "9.15",
        questionText:
          "Are incentive or protective trust provisions considered for heirs who need additional structure?",
        whyThisMatters:
          "Unconstrained inheritance can harm unprepared or at-risk beneficiaries.",
        recommendedActions:
          "Consider staged or incentive-based distribution terms.",
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
    sectionName: "Business & enterprise succession",
    questions: [
      {
        questionNumber: "9.16",
        questionText:
          "Is a buy-sell agreement in place and funded for any closely held business interests?",
        whyThisMatters:
          "Without a funded buy-sell, an owner's death can trigger disputes or a fire-sale of the business.",
        recommendedActions:
          "Execute and fund a buy-sell agreement with a current valuation method.",
      },
      {
        questionNumber: "9.17",
        questionText:
          "Is there a written management-succession plan naming and preparing successors for key roles?",
        whyThisMatters:
          "Businesses fail transitions without prepared, identified leadership.",
        recommendedActions:
          "Identify and develop successors well ahead of any transition.",
      },
      {
        questionNumber: "9.18",
        questionText:
          "Is a current business valuation maintained for estate, tax, and transfer purposes?",
        whyThisMatters:
          "Stale valuations distort estate, buy-sell, and transfer outcomes.",
        recommendedActions:
          "Obtain periodic independent business valuations.",
      },
      {
        questionNumber: "9.19",
        questionText:
          "Are ownership-transfer mechanics (voting vs. non-voting interests, timelines) defined for the enterprise?",
        whyThisMatters:
          "Ambiguous transfer mechanics create control disputes among heirs.",
        recommendedActions:
          "Define transfer structure and control provisions in advance.",
      },
      {
        questionNumber: "9.20",
        questionText:
          "Is key-person and business-continuity risk addressed with insurance or contingency plans?",
        whyThisMatters:
          "Loss of a key principal can cripple the enterprise and the estate that depends on it.",
        recommendedActions:
          "Insure key persons and document business-continuity plans.",
      },
    ],
  },
  {
    categoryCode: "9_estate",
    categoryName: "Estate & Succession",
    sheetName: "Estate",
    displayOrder: 9,
    slug: "estate-succession",
    sectionCode: "E",
    sectionName: "Digital assets & records",
    questions: [
      {
        questionNumber: "9.21",
        questionText:
          "Is access to digital assets, accounts, and passwords documented for fiduciaries?",
        whyThisMatters:
          "Locked digital accounts can strand assets and disrupt operations after incapacity or death.",
        recommendedActions:
          "Maintain a secure, updated digital-access directory with legal authority to use it.",
      },
      {
        questionNumber: "9.22",
        questionText:
          "Are cryptocurrency and other digital-asset holdings inventoried with secure succession access?",
        whyThisMatters:
          "Digital assets with lost keys are permanently unrecoverable by heirs.",
        recommendedActions:
          "Document holdings and secure key-recovery instructions for fiduciaries.",
      },
      {
        questionNumber: "9.23",
        questionText:
          "Is a consolidated inventory of assets, liabilities, and advisors maintained for executors?",
        whyThisMatters:
          "Executors waste months and money reconstructing an estate that was never inventoried.",
        recommendedActions:
          "Keep a current master inventory and share its location with fiduciaries.",
      },
      {
        questionNumber: "9.24",
        questionText:
          "Are important physical documents and records secured, with their location known to fiduciaries?",
        whyThisMatters:
          "Lost originals delay or invalidate estate actions.",
        recommendedActions:
          "Secure original documents and record their storage location.",
      },
      {
        questionNumber: "9.25",
        questionText:
          "Is there explicit legal authority for fiduciaries to access digital and online accounts?",
        whyThisMatters:
          "Without granted authority, providers deny fiduciaries access to online accounts.",
        recommendedActions:
          "Include digital-asset authority in wills, trusts, and powers of attorney.",
      },
    ],
  },
  {
    categoryCode: "9_estate",
    categoryName: "Estate & Succession",
    sheetName: "Estate",
    displayOrder: 9,
    slug: "estate-succession",
    sectionCode: "F",
    sectionName: "Liquidity, tax & fiduciary execution",
    questions: [
      {
        questionNumber: "9.26",
        questionText:
          "Is estate liquidity sufficient to cover taxes and settlement costs without forced asset sales?",
        whyThisMatters:
          "Illiquid estates can force heirs to sell prized assets under time pressure to pay taxes.",
        recommendedActions:
          "Model settlement costs and earmark or insure liquidity to cover them.",
      },
      {
        questionNumber: "9.27",
        questionText:
          "Is life insurance used and structured (e.g., through an ILIT) appropriately for estate liquidity and transfer?",
        whyThisMatters:
          "Poorly structured insurance can add to the taxable estate rather than relieve it.",
        recommendedActions:
          "Review policy ownership and beneficiary structure with counsel.",
      },
      {
        questionNumber: "9.28",
        questionText:
          "Are philanthropic and legacy intentions documented and integrated into the estate plan?",
        whyThisMatters:
          "Undocumented charitable intent is often lost or contested after death.",
        recommendedActions:
          "Formalize legacy goals in the plan and align giving vehicles to them.",
      },
      {
        questionNumber: "9.29",
        questionText:
          "Have executors and fiduciaries been briefed on their roles and the location of key information?",
        whyThisMatters:
          "Unprepared fiduciaries mishandle or delay estate settlement.",
        recommendedActions:
          "Brief fiduciaries and provide an access roadmap to key information.",
      },
      {
        questionNumber: "9.30",
        questionText:
          "Is the overall estate plan coordinated across tax, investment, insurance, and legal advisors?",
        whyThisMatters:
          "Siloed advisors produce conflicting or duplicative estate strategies.",
        recommendedActions:
          "Coordinate the estate plan across the full advisory team.",
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
          "Is communication across generations and branches of the family open and regular?",
        whyThisMatters:
          "Poor communication breeds mistrust, rumor, and misalignment over time.",
        recommendedActions:
          "Establish regular, inclusive communication channels across the family.",
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
          "Heirs who never learn to steward wealth are a primary reason wealth fails to transfer.",
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
      {
        questionNumber: "10.10",
        questionText:
          "Are heirs prepared for the personal pressures that accompany wealth (relationships, requests, identity)?",
        whyThisMatters:
          "Unprepared heirs struggle with the social and emotional weight of wealth.",
        recommendedActions:
          "Provide coaching on the personal dimensions of inherited wealth.",
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
        questionNumber: "10.11",
        questionText:
          "Is there a documented protocol for making major decisions during a crisis or loss of a principal?",
        whyThisMatters:
          "Decisions made in shock, without a protocol, are frequently regretted and costly.",
        recommendedActions:
          "Pre-define who decides what, and how, when a principal is unavailable.",
      },
      {
        questionNumber: "10.12",
        questionText:
          "Are major decisions subject to a cooling-off period or a second-opinion requirement?",
        whyThisMatters:
          "Urgency and pressure tactics drive impulsive commitments that a pause would prevent.",
        recommendedActions:
          "Require a waiting period and independent review above a decision threshold.",
      },
      {
        questionNumber: "10.13",
        questionText:
          "Has the family rehearsed or scenario-planned for emergencies (incapacity, death, reputational event)?",
        whyThisMatters:
          "Families that have never rehearsed a crisis improvise badly when one arrives.",
        recommendedActions:
          "Run periodic tabletop exercises for the most consequential scenarios.",
      },
      {
        questionNumber: "10.14",
        questionText:
          "Are roles clear for who leads and who communicates during a family emergency?",
        whyThisMatters:
          "Ambiguous crisis roles cause paralysis, missteps, and mixed messages.",
        recommendedActions:
          "Assign crisis leadership and communication roles in advance.",
      },
      {
        questionNumber: "10.15",
        questionText:
          "Is emotional and psychological support available to family members during major transitions?",
        whyThisMatters:
          "Grief and acute stress impair judgment precisely when big decisions are made.",
        recommendedActions:
          "Line up counseling and facilitation support ahead of major transitions.",
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
        questionNumber: "10.16",
        questionText:
          "Is there a written investment policy that constrains impulsive or emotionally driven decisions?",
        whyThisMatters:
          "A policy set in calm conditions is the best defense against panic and euphoria.",
        recommendedActions:
          "Adopt an investment policy statement and hold decisions accountable to it.",
      },
      {
        questionNumber: "10.17",
        questionText:
          "Are new investment opportunities screened against a checklist before capital is committed?",
        whyThisMatters:
          "Deals framed as rare, time-limited opportunities bypass diligence and concentrate hidden risk.",
        recommendedActions:
          "Require every opportunity to pass a standard diligence checklist first.",
      },
      {
        questionNumber: "10.18",
        questionText:
          "Is susceptibility to affinity fraud and unsolicited pitches actively guarded against?",
        whyThisMatters:
          "Wealthy families are prime targets for fraud that exploits trust and social ties.",
        recommendedActions:
          "Route unsolicited offers through advisors and verify counterparties independently.",
      },
      {
        questionNumber: "10.19",
        questionText:
          "Are concentration, leverage, and urgency biases explicitly checked before major financial moves?",
        whyThisMatters:
          "These recurring biases repeatedly drive avoidable, compounding losses.",
        recommendedActions:
          "Add an explicit bias check to major-decision reviews.",
      },
      {
        questionNumber: "10.20",
        questionText:
          "Is performance judged against long-term goals rather than short-term market moves or peers?",
        whyThisMatters:
          "Chasing short-term results or comparing to peers compounds risk-taking.",
        recommendedActions:
          "Anchor decisions to long-term goals and the written financial plan.",
      },
    ],
  },
  {
    categoryCode: "10_family_governance",
    categoryName: "Behavioral Resilience",
    sheetName: "Behavioral Resilience",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "E",
    sectionName: "Values, purpose & legacy",
    questions: [
      {
        questionNumber: "10.21",
        questionText:
          "Does the family have an articulated shared purpose or mission for its wealth?",
        whyThisMatters:
          "Wealth without a shared purpose loses meaning and weakens family cohesion.",
        recommendedActions:
          "Draft and periodically revisit a family purpose statement.",
      },
      {
        questionNumber: "10.22",
        questionText:
          "Are philanthropic values and priorities defined and shared across the family?",
        whyThisMatters:
          "Undefined giving priorities cause drift, inconsistency, and conflict.",
        recommendedActions:
          "Define shared philanthropic goals and assign roles.",
      },
      {
        questionNumber: "10.23",
        questionText:
          "Is the family's story, history, and values documented for future generations?",
        whyThisMatters:
          "A lost family narrative weakens identity, belonging, and stewardship.",
        recommendedActions:
          "Capture family history and values in a durable, shareable form.",
      },
      {
        questionNumber: "10.24",
        questionText:
          "Are expectations around work, self-sufficiency, and wealth communicated to the next generation?",
        whyThisMatters:
          "Unspoken expectations breed entitlement, confusion, or resentment.",
        recommendedActions:
          "Communicate clear expectations about wealth, work, and independence.",
      },
      {
        questionNumber: "10.25",
        questionText:
          "Is there alignment between individual members' goals and the collective family vision?",
        whyThisMatters:
          "Misaligned individual and collective goals create ongoing friction.",
        recommendedActions:
          "Reconcile individual aspirations with the shared family vision.",
      },
    ],
  },
  {
    categoryCode: "10_family_governance",
    categoryName: "Behavioral Resilience",
    sheetName: "Behavioral Resilience",
    displayOrder: 10,
    slug: "family-governance-behavioral",
    sectionCode: "F",
    sectionName: "Advisory support & continuity",
    questions: [
      {
        questionNumber: "10.26",
        questionText:
          "Is professional facilitation or family-therapy support available for sensitive transitions?",
        whyThisMatters:
          "Major transitions (succession, death, divorce) overwhelm families without skilled support.",
        recommendedActions:
          "Identify facilitators or advisors to engage before high-stress transitions.",
      },
      {
        questionNumber: "10.27",
        questionText:
          "Does the family have trusted advisors who understand its history, dynamics, and goals?",
        whyThisMatters:
          "Advisors without context give ill-fitting advice at critical moments.",
        recommendedActions:
          "Build long-term relationships with context-aware advisors.",
      },
      {
        questionNumber: "10.28",
        questionText:
          "Is there continuity planning for key advisor relationships (succession of the advisory team)?",
        whyThisMatters:
          "Losing a key advisor without a successor disrupts continuity and institutional memory.",
        recommendedActions:
          "Plan for advisor succession and structured knowledge transfer.",
      },
      {
        questionNumber: "10.29",
        questionText:
          "Are family governance documents and decisions recorded and accessible over time?",
        whyThisMatters:
          "Undocumented governance is forgotten and re-litigated across generations.",
        recommendedActions:
          "Maintain durable, accessible records of governance decisions.",
      },
      {
        questionNumber: "10.30",
        questionText:
          "Is the family's resilience and governance reviewed and refreshed on a regular cadence?",
        whyThisMatters:
          "Governance and resilience atrophy without periodic renewal.",
        recommendedActions:
          "Schedule regular reviews of family governance and resilience.",
      },
    ],
  },
];

export { SCORED_0_3 };
