/**
 * Starter assessment questions for the four platform pillars added in v3.0.
 * Seeded into PillarCategory / PillarSection / PillarQuestion via seed:new-pillar-questions.
 *
 * One array entry == one section. Entries that share a `categoryCode` are
 * grouped under the same pillar category by the seeder (category is upserted
 * by code, sections by `categoryId + sectionCode`). Section ordering is by
 * `sectionCode` (A, B, C, D…) — keep codes alphabetical to control order.
 *
 * Each pillar has six sections (A–F) of five scored questions each (30 per
 * pillar). `answers` are the tailored 0→3 maturity anchors (0 = absent/critical
 * gap, 3 = institutionalized) shown as the option labels for each scored_0_3
 * question.
 *
 * The fourth pillar is "AI & Emerging Tech Risk" (categoryCode "10_ai", slug
 * "ai-emerging-tech"). It replaced the former Behavioral Resilience pillar;
 * question numbers 7.1-7.3, 8.1-8.3, 9.1-9.3 keep their exact text so
 * re-seeding stays idempotent, and the 10.x numbers overwrite the former
 * Behavioral Resilience rows 1:1 in place. (The DB rename of the old slug
 * `family-governance-behavioral` / code `10_family_governance` is handled by
 * migration `20260714120000_rename_family_governance_behavioral_to_ai`.)
 */

export type NewPillarQuestionStarter = {
  questionNumber: string;
  questionText: string;
  whyThisMatters: string;
  recommendedActions: string;
  /** Tailored maturity anchors for the 0/1/2/3 options (index 0 = worst). */
  answers: [string, string, string, string];
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
        answers: ["No dedicated reserve", "Ad hoc cash, no target", "~6 months held", "6+ months, policy-governed and replenished"],
      },
      {
        questionNumber: "7.2",
        questionText:
          "Are committed lines of credit documented, annually reviewed, and tested for availability under stress?",
        whyThisMatters:
          "Credit capacity is part of liquidity — unused lines can fail when needed most.",
        recommendedActions:
          "Confirm covenants, maturity dates, and draw procedures with your banking team.",
        answers: ["No committed lines", "Lines exist, unreviewed", "Documented and reviewed annually", "Reviewed and stress-tested for availability"],
      },
      {
        questionNumber: "7.3",
        questionText:
          "Is illiquid wealth concentration stress-tested against near-term capital calls and tax obligations?",
        whyThisMatters:
          "Concentrated private holdings can create liquidity cliffs even when net worth appears strong.",
        recommendedActions:
          "Model liquidity gaps across 12-, 24-, and 36-month horizons.",
        answers: ["Never assessed", "Rough awareness only", "Stress-tested periodically", "Stress-tested across multiple horizons"],
      },
      {
        questionNumber: "7.4",
        questionText:
          "Is there a written liquidity policy that sets target reserve levels and defines who authorizes drawdowns?",
        whyThisMatters:
          "Without a policy, reserve decisions are ad hoc and reserves are quietly depleted for non-emergencies.",
        recommendedActions:
          "Document target ranges, permitted uses, and approval authority for the reserve.",
        answers: ["No policy", "Informal understanding", "Written policy exists", "Policy with targets and approval authority"],
      },
      {
        questionNumber: "7.5",
        questionText:
          "Is reserve adequacy reviewed at least annually and updated for lifestyle, family, or obligation changes?",
        whyThisMatters:
          "Liquidity needs drift as spending, family size, and commitments change over time.",
        recommendedActions:
          "Schedule an annual liquidity review tied to the broader financial plan.",
        answers: ["Never reviewed", "Reviewed irregularly", "Reviewed annually", "Reviewed annually and updated for changes"],
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
        answers: ["Single lender", "Mostly one lender", "Two lenders", "Diversified with standby capacity"],
      },
      {
        questionNumber: "7.7",
        questionText:
          "Are pledged-asset and margin lending arrangements monitored against collateral-value trigger points?",
        whyThisMatters:
          "A market drop can force a margin call or collateral top-up precisely when liquidity is scarcest.",
        recommendedActions:
          "Track loan-to-value headroom and set alerts well above the maintenance threshold.",
        answers: ["Unmonitored", "Occasional check", "Monitored with thresholds", "Monitored with alerts above maintenance"],
      },
      {
        questionNumber: "7.8",
        questionText:
          "Is total household leverage measured against a defined debt-to-liquid-assets ceiling?",
        whyThisMatters:
          "Leverage that looks modest against net worth can be extreme against truly liquid assets.",
        recommendedActions:
          "Set and monitor a maximum leverage ratio expressed against liquid assets.",
        answers: ["No ceiling tracked", "Rough sense of leverage", "Ceiling defined", "Ceiling vs liquid assets, monitored"],
      },
      {
        questionNumber: "7.9",
        questionText:
          "Are loan covenants, maturities, and refinancing timelines tracked to avoid forced refinancing in poor conditions?",
        whyThisMatters:
          "Maturities that cluster or fall in a bad market force costly refinancing or asset sales.",
        recommendedActions:
          "Maintain a debt-maturity ladder and refinance proactively before deadlines.",
        answers: ["Not tracked", "Partially tracked", "Tracked", "Maturity ladder, refinanced proactively"],
      },
      {
        questionNumber: "7.10",
        questionText:
          "Is interest-rate exposure on variable-rate debt understood and hedged where appropriate?",
        whyThisMatters:
          "Rising rates can sharply increase debt service and strain household cash flow.",
        recommendedActions:
          "Model rate scenarios and consider fixing or hedging material exposures.",
        answers: ["Unaware of exposure", "Aware but unhedged", "Understood", "Understood and hedged where appropriate"],
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
        answers: ["No limits", "Informal awareness", "Limits defined", "Limits with diversification plan"],
      },
      {
        questionNumber: "7.12",
        questionText:
          "Are capital-call obligations from private investments forecast and pre-funded?",
        whyThisMatters:
          "Unfunded capital calls can force distressed sales or default on commitments.",
        recommendedActions:
          "Maintain a rolling capital-call calendar and earmark liquidity to meet it.",
        answers: ["Not forecast", "Rough forecast", "Forecast on calendar", "Forecast and pre-funded"],
      },
      {
        questionNumber: "7.13",
        questionText:
          "Is a current schedule of lock-ups, gates, and redemption windows maintained across illiquid holdings?",
        whyThisMatters:
          "Assumed liquidity often disappears behind lock-ups and gates when it is actually needed.",
        recommendedActions:
          "Catalog redemption terms per holding and factor them into liquidity planning.",
        answers: ["Not tracked", "Partial list", "Schedule maintained", "Schedule integrated into planning"],
      },
      {
        questionNumber: "7.14",
        questionText:
          "Are private and concentrated holdings valued and reviewed on a regular schedule?",
        whyThisMatters:
          "Stale valuations mask concentration risk and mislead liquidity and estate planning.",
        recommendedActions:
          "Obtain periodic valuations for material illiquid positions.",
        answers: ["Never valued", "Outdated valuations", "Valued periodically", "Regular independent valuations"],
      },
      {
        questionNumber: "7.15",
        questionText:
          "Is there a diversification or monetization plan for a dominant concentrated position (e.g., founder stock)?",
        whyThisMatters:
          "Wealth anchored to one security is exposed to a single company's fate.",
        recommendedActions:
          "Use staged selling, hedging, or exchange strategies to reduce concentration.",
        answers: ["No plan", "Vague intent", "Plan defined", "Staged plan with hedging or selling"],
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
        answers: ["No calendar", "Mental tracking only", "Calendar maintained", "Calendar reconciled quarterly"],
      },
      {
        questionNumber: "7.17",
        questionText:
          "Is a liquidity contingency plan documented for a sudden loss of income or a sharp market drawdown?",
        whyThisMatters:
          "Improvised responses to a shock usually lock in losses and erode long-term wealth.",
        recommendedActions:
          "Pre-decide which levers to pull, and in what order, before a shock occurs.",
        answers: ["No plan", "Informal ideas", "Documented plan", "Documented and sequenced levers"],
      },
      {
        questionNumber: "7.18",
        questionText:
          "Are cash balances swept and structured to avoid idle, uninsured, or under-yielding deposits?",
        whyThisMatters:
          "Large idle balances lose value to inflation and can exceed deposit-insurance protection.",
        recommendedActions:
          "Automate sweeps and spread deposits to optimize yield and insured coverage.",
        answers: ["Idle balances", "Some optimization", "Swept and optimized", "Automated sweep, yield and insured"],
      },
      {
        questionNumber: "7.19",
        questionText:
          "Are large or irregular expenses (major purchases, renovations, events) planned and pre-funded?",
        whyThisMatters:
          "Lumpy discretionary spending can quietly drain reserves without a plan.",
        recommendedActions:
          "Budget and pre-fund known large expenditures ahead of time.",
        answers: ["Unplanned", "Partially planned", "Planned", "Budgeted and pre-funded"],
      },
      {
        questionNumber: "7.20",
        questionText:
          "Is household spending tracked against a defined budget or spending policy?",
        whyThisMatters:
          "Lifestyle creep erodes liquidity and long-term financial sustainability.",
        recommendedActions:
          "Adopt a spending policy and monitor actual spending against it.",
        answers: ["No budget", "Loose tracking", "Budget in place", "Spending policy monitored vs actuals"],
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
        answers: ["Concentrated, uninsured", "Some spreading", "Within insured limits", "Diversified with insured-sweep"],
      },
      {
        questionNumber: "7.22",
        questionText:
          "Is the credit quality of banks, custodians, and money-market holdings periodically reviewed?",
        whyThisMatters:
          "Even large institutions can fail or freeze access to funds.",
        recommendedActions:
          "Monitor counterparty ratings and diversify custody arrangements.",
        answers: ["Never reviewed", "Rarely reviewed", "Reviewed periodically", "Monitored and diversified"],
      },
      {
        questionNumber: "7.23",
        questionText:
          "Are wire-transfer and payment controls in place to prevent fraud on large cash movements?",
        whyThisMatters:
          "Large transfers are prime targets for fraud, interception, and error.",
        recommendedActions:
          "Require call-back verification and dual approval for material wires.",
        answers: ["No controls", "Basic controls", "Verification in place", "Call-back and dual approval"],
      },
      {
        questionNumber: "7.24",
        questionText:
          "Is there redundancy in banking access (multiple institutions, backup payment methods) for continuity?",
        whyThisMatters:
          "A single frozen or compromised account can halt payments entirely.",
        recommendedActions:
          "Maintain backup accounts and alternate payment channels.",
        answers: ["Single account", "Limited backup", "Backup accounts", "Redundant accounts and channels"],
      },
      {
        questionNumber: "7.25",
        questionText:
          "Are foreign-currency and cross-border cash needs planned to avoid unfavorable conversions or access delays?",
        whyThisMatters:
          "Currency timing and cross-border frictions can be costly when liquidity is urgent.",
        recommendedActions:
          "Pre-position currency and confirm cross-border access in advance.",
        answers: ["Unplanned", "Reactive", "Planned", "Pre-positioned with confirmed access"],
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
        answers: ["None", "Informal arrangement", "Backup named", "Backup named with tested access"],
      },
      {
        questionNumber: "7.27",
        questionText:
          "Is liquidity reporting consolidated across accounts and institutions into a single view?",
        whyThisMatters:
          "Fragmented reporting hides the household's true available liquidity.",
        recommendedActions:
          "Consolidate reporting into one regularly updated dashboard.",
        answers: ["Fragmented", "Partial view", "Consolidated", "Single dashboard, regularly updated"],
      },
      {
        questionNumber: "7.28",
        questionText:
          "Are liquidity metrics reviewed with advisors on a set cadence with clear thresholds and alerts?",
        whyThisMatters:
          "Without cadence and thresholds, liquidity problems surface too late to manage well.",
        recommendedActions:
          "Set review cadence and trigger levels with your advisory team.",
        answers: ["Never reviewed", "Ad hoc", "Set cadence", "Cadence with thresholds and alerts"],
      },
      {
        questionNumber: "7.29",
        questionText:
          "Has the household stress-tested liquidity against a severe combined scenario (market drop, income loss, capital call)?",
        whyThisMatters:
          "Individual shocks are survivable; simultaneous shocks are what break plans.",
        recommendedActions:
          "Run a combined-shock liquidity stress test at least annually.",
        answers: ["Never done", "Single-shock only", "Combined test done", "Combined test run annually"],
      },
      {
        questionNumber: "7.30",
        questionText:
          "Is documentation of accounts, facilities, and access instructions maintained for advisors and fiduciaries?",
        whyThisMatters:
          "Undocumented access strands liquidity when principals are unavailable.",
        recommendedActions:
          "Keep a secure, current directory of accounts, facilities, and access.",
        answers: ["Undocumented", "Partial notes", "Documented", "Secure, current directory for fiduciaries"],
      },
    ],
  },
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
        answers: ["Undocumented", "Informal awareness", "Documented", "Documented and reviewed annually with counsel"],
      },
      {
        questionNumber: "8.2",
        questionText:
          "Are compensation, deferral, and equity-compensation tax impacts modeled before major liquidity events?",
        whyThisMatters:
          "Large cash events often carry AMT, NIIT, or state-tax surprises without proactive modeling.",
        recommendedActions:
          "Run scenario models before exercising options or selling concentrated positions.",
        answers: ["Never modeled", "Rough estimates", "Modeled before events", "Scenario-modeled with advisors"],
      },
      {
        questionNumber: "8.3",
        questionText:
          "Is estate-tax exposure mapped across entities, trusts, and beneficiary designations?",
        whyThisMatters:
          "Misaligned documents can increase transfer-tax exposure despite prior planning.",
        recommendedActions:
          "Reconcile entity charts, beneficiary forms, and trust funding annually.",
        answers: ["Not mapped", "Partial view", "Mapped", "Mapped and reconciled annually"],
      },
      {
        questionNumber: "8.4",
        questionText:
          "Is there a coordinated annual tax-planning cycle among the CPA, attorney, and investment advisor?",
        whyThisMatters:
          "Advisors working in silos leave planning gaps and duplicate or conflicting strategies.",
        recommendedActions:
          "Convene an annual joint planning session with all tax-relevant advisors.",
        answers: ["Advisors siloed", "Occasional coordination", "Annual cycle", "Integrated annual planning session"],
      },
      {
        questionNumber: "8.5",
        questionText:
          "Are current-year and projected tax liabilities pre-funded to avoid liquidity strain at filing or payment deadlines?",
        whyThisMatters:
          "Underestimated liabilities force asset sales or penalties when payments come due.",
        recommendedActions:
          "Reserve for estimated taxes and reconcile projections each quarter.",
        answers: ["Not reserved", "Rough reserve", "Reserved", "Reserved and reconciled quarterly"],
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
        answers: ["Not tracked", "Rough recollection", "Tracked", "Tracked and reviewed before year-end"],
      },
      {
        questionNumber: "8.7",
        questionText:
          "Is exposure to multi-state or cross-border income (property, business, wages) reviewed for double taxation?",
        whyThisMatters:
          "Income sourced across jurisdictions can be taxed twice without proper credits and structuring.",
        recommendedActions:
          "Map income sources to jurisdictions and confirm available credits with counsel.",
        answers: ["Not reviewed", "Aware of exposure", "Reviewed", "Reviewed with credits confirmed"],
      },
      {
        questionNumber: "8.8",
        questionText:
          "Are foreign accounts and assets compliant with all applicable reporting obligations (e.g., FBAR, FATCA)?",
        whyThisMatters:
          "Foreign-asset reporting failures carry severe penalties even when no tax is owed.",
        recommendedActions:
          "Inventory foreign holdings and confirm every required disclosure is filed.",
        answers: ["Non-compliant or unknown", "Partially compliant", "Compliant", "Compliant and inventoried"],
      },
      {
        questionNumber: "8.9",
        questionText:
          "Are the tax implications of relocation or a new residence modeled before the move?",
        whyThisMatters:
          "Moves can trigger exit taxes, changed source-income rules, and other surprises.",
        recommendedActions:
          "Model the full tax impact before establishing a new residence.",
        answers: ["Not modeled", "Rough sense", "Modeled", "Fully modeled before move"],
      },
      {
        questionNumber: "8.10",
        questionText:
          "Is exposure to local property, transfer, and wealth taxes across jurisdictions understood?",
        whyThisMatters:
          "Sub-national and foreign levies add up and are easily overlooked in planning.",
        recommendedActions:
          "Catalog jurisdiction-specific taxes on each property and asset.",
        answers: ["Unaware", "Partial awareness", "Understood", "Cataloged per property and asset"],
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
        answers: ["Not managed", "Some awareness", "Managed", "Asset-location and harvesting disciplined"],
      },
      {
        questionNumber: "8.12",
        questionText:
          "Are the timing and structure of large transactions planned for tax impact (installment sales, 1031, QSBS)?",
        whyThisMatters:
          "Poorly timed or structured transactions forfeit large, avoidable tax savings.",
        recommendedActions:
          "Plan transaction structure and timing with counsel before closing.",
        answers: ["Unplanned", "Basic planning", "Planned", "Structured with counsel pre-close"],
      },
      {
        questionNumber: "8.13",
        questionText:
          "Is AMT, NIIT, and surtax exposure projected before triggering events?",
        whyThisMatters:
          "These surtaxes ambush unprepared taxpayers in high-income years.",
        recommendedActions:
          "Project exposure and plan around the triggering thresholds.",
        answers: ["Not projected", "Rough sense", "Projected", "Projected and planned around thresholds"],
      },
      {
        questionNumber: "8.14",
        questionText:
          "Are equity-compensation decisions (exercise, vesting, 83(b) elections) evaluated for tax outcomes?",
        whyThisMatters:
          "The timing of option and RSU events drives large, avoidable tax bills.",
        recommendedActions:
          "Model each equity-compensation decision before acting.",
        answers: ["Not evaluated", "Basic awareness", "Evaluated", "Each decision modeled"],
      },
      {
        questionNumber: "8.15",
        questionText:
          "Is estimated-tax and withholding accuracy monitored to avoid penalties and large true-ups?",
        whyThisMatters:
          "Under-withholding creates penalties and painful year-end surprises.",
        recommendedActions:
          "Review withholding and estimated payments each quarter.",
        answers: ["Not monitored", "Annual check", "Monitored", "Reviewed quarterly"],
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
        answers: ["Never reviewed", "Rarely reviewed", "Reviewed", "Reassessed on legislative change"],
      },
      {
        questionNumber: "8.17",
        questionText:
          "Are pass-through and entity elections (S-corp, partnership, PTET) reviewed and optimized annually?",
        whyThisMatters:
          "Suboptimal elections leave money on the table every year.",
        recommendedActions:
          "Review elections annually with your CPA before deadlines.",
        answers: ["Not reviewed", "Occasional review", "Reviewed annually", "Optimized annually with CPA"],
      },
      {
        questionNumber: "8.18",
        questionText:
          "Is the tax treatment of business income, distributions, and owner compensation defensible?",
        whyThisMatters:
          "Aggressive or careless positions invite audit, reclassification, and penalties.",
        recommendedActions:
          "Document and support entity-level tax positions.",
        answers: ["Undocumented", "Weakly supported", "Documented", "Documented and fully supported"],
      },
      {
        questionNumber: "8.19",
        questionText:
          "Are intra-family and related-party transactions structured at arm's length and documented?",
        whyThisMatters:
          "Related-party dealings draw scrutiny and reclassification risk.",
        recommendedActions:
          "Document terms and valuations for all family transactions.",
        answers: ["Undocumented", "Informal terms", "Documented", "Arm's length and documented"],
      },
      {
        questionNumber: "8.20",
        questionText:
          "Are state-level entity and nexus obligations reviewed as the business or asset base expands?",
        whyThisMatters:
          "Growth silently creates new filing, registration, and nexus obligations.",
        recommendedActions:
          "Reassess nexus and registrations as the footprint grows.",
        answers: ["Not reviewed", "Reactive", "Reviewed", "Reassessed as footprint grows"],
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
        answers: ["Unused", "Occasional gifting", "Used annually", "Planned to use before lapse"],
      },
      {
        questionNumber: "8.22",
        questionText:
          "Is charitable giving structured (donor-advised fund, charitable trust, foundation) to optimize deductions and legacy goals?",
        whyThisMatters:
          "Unstructured giving forfeits deductions and misses opportunities to advance legacy aims.",
        recommendedActions:
          "Match giving vehicles to income, appreciation, and philanthropic objectives.",
        answers: ["Unstructured", "Basic giving", "Structured", "Vehicles matched to objectives"],
      },
      {
        questionNumber: "8.23",
        questionText:
          "Are appreciated assets used for gifting and charitable giving to maximize tax efficiency?",
        whyThisMatters:
          "Gifting cash instead of appreciated assets wastes available tax benefits.",
        recommendedActions:
          "Prioritize appreciated-asset gifting where appropriate.",
        answers: ["Cash only", "Sometimes", "Often used", "Prioritized where appropriate"],
      },
      {
        questionNumber: "8.24",
        questionText:
          "Is basis planning (step-up, carryover, gifting timing) coordinated with the estate plan?",
        whyThisMatters:
          "Ignoring basis can cost heirs more than the transfer-tax savings gained.",
        recommendedActions:
          "Coordinate basis strategy with estate counsel.",
        answers: ["Ignored", "Considered", "Coordinated", "Integrated with estate plan"],
      },
      {
        questionNumber: "8.25",
        questionText:
          "Are advanced transfer techniques (GRAT, SLAT, IDGT) evaluated where appropriate to the estate?",
        whyThisMatters:
          "Failing to use available techniques leaves transfer tax on the table.",
        recommendedActions:
          "Evaluate advanced strategies with estate and tax counsel.",
        answers: ["Not considered", "Aware", "Evaluated", "Implemented where appropriate"],
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
        answers: ["Late or missed", "Occasionally late", "On time", "On time, calendar-tracked"],
      },
      {
        questionNumber: "8.27",
        questionText:
          "Is supporting documentation organized and retained so filings can withstand an audit?",
        whyThisMatters:
          "Missing records turn a routine audit into an expensive, adverse outcome.",
        recommendedActions:
          "Keep organized, retention-compliant records for every material position.",
        answers: ["Disorganized", "Partial records", "Organized", "Audit-ready and retention-compliant"],
      },
      {
        questionNumber: "8.28",
        questionText:
          "Is there a defined process and named advisor for responding to tax-authority notices or audits?",
        whyThisMatters:
          "Delayed or uncoordinated responses to notices escalate disputes and penalties.",
        recommendedActions:
          "Pre-designate who handles notices and how they are triaged and answered.",
        answers: ["No process", "Ad hoc", "Defined process", "Defined process and named advisor"],
      },
      {
        questionNumber: "8.29",
        questionText:
          "Are aggressive positions and their risk levels reviewed and understood before filing?",
        whyThisMatters:
          "Unassessed aggressive positions expose the family to penalties and disputes.",
        recommendedActions:
          "Assess and document the risk of each material position before filing.",
        answers: ["Unassessed", "Loosely considered", "Assessed", "Assessed and documented before filing"],
      },
      {
        questionNumber: "8.30",
        questionText:
          "Is a complete, current record of entities, trusts, and their filing obligations centrally maintained?",
        whyThisMatters:
          "Fragmented records cause missed filings and compliance gaps.",
        recommendedActions:
          "Maintain a central register of all entities and their obligations.",
        answers: ["No record", "Fragmented", "Central record", "Central register with obligations"],
      },
    ],
  },
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
        answers: ["Missing or outdated", "Some in place", "Current and signed", "Current, signed and accessible"],
      },
      {
        questionNumber: "9.2",
        questionText:
          "Are beneficiary designations aligned across retirement accounts, insurance, and transfer-on-death registrations?",
        whyThisMatters:
          "Beneficiary forms override wills and are a common source of unintended transfers.",
        recommendedActions:
          "Audit all beneficiary designations after major life events.",
        answers: ["Unaligned or unknown", "Partially aligned", "Aligned", "Aligned and audited after life events"],
      },
      {
        questionNumber: "9.3",
        questionText:
          "Is there a documented business or family-enterprise succession protocol for key principals?",
        whyThisMatters:
          "Operating businesses fail transitions without clear decision rights and contingency plans.",
        recommendedActions:
          "Document succession triggers, voting control, and interim leadership authority.",
        answers: ["None", "Informal", "Documented", "Documented with triggers and authority"],
      },
      {
        questionNumber: "9.4",
        questionText:
          "Are healthcare directives and HIPAA authorizations in place and shared with the designated agents?",
        whyThisMatters:
          "Without directives, medical decisions stall and agents are denied information in a crisis.",
        recommendedActions:
          "Execute advance directives and distribute them to agents and providers.",
        answers: ["None", "Basic form", "In place", "In place and shared with agents"],
      },
      {
        questionNumber: "9.5",
        questionText:
          "Are durable financial powers of attorney current and confirmed acceptable to key institutions?",
        whyThisMatters:
          "A rejected or stale power of attorney leaves no one able to act on financial matters.",
        recommendedActions:
          "Confirm institutions will honor the power of attorney and refresh it as needed.",
        answers: ["None or rejected", "Untested", "Current", "Current and confirmed acceptable"],
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
        answers: ["Unfunded", "Partially funded", "Funded", "Fully funded and titled"],
      },
      {
        questionNumber: "9.7",
        questionText:
          "Are trustees and successor trustees named, qualified, and aware of their duties?",
        whyThisMatters:
          "Unprepared or missing trustees create governance gaps and disputes after a death.",
        recommendedActions:
          "Confirm successor trustees and brief them on their responsibilities.",
        answers: ["None named", "Named only", "Named and qualified", "Named, qualified and briefed"],
      },
      {
        questionNumber: "9.8",
        questionText:
          "Is the estate plan reviewed after major life, tax-law, or significant asset changes?",
        whyThisMatters:
          "Plans drift out of alignment with reality as families, laws, and assets change.",
        recommendedActions:
          "Schedule periodic reviews and re-review after any triggering event.",
        answers: ["Never reviewed", "Rarely reviewed", "Periodically reviewed", "Periodic and event-triggered"],
      },
      {
        questionNumber: "9.9",
        questionText:
          "Are trust terms aligned with current family circumstances and intentions?",
        whyThisMatters:
          "Outdated trust terms can frustrate current goals and family realities.",
        recommendedActions:
          "Review and, where possible, modernize trust terms.",
        answers: ["Outdated", "Partly aligned", "Aligned", "Aligned and modernized"],
      },
      {
        questionNumber: "9.10",
        questionText:
          "Is the choice between individual and corporate trustees evaluated for complex or long-term trusts?",
        whyThisMatters:
          "The wrong trustee structure creates conflict, mismanagement, or excessive cost.",
        recommendedActions:
          "Assess the trustee structure for each significant trust.",
        answers: ["Not considered", "Default choice", "Evaluated", "Evaluated per trust"],
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
        answers: ["Not discussed", "Vaguely discussed", "Communicated", "Communicated with roles explained"],
      },
      {
        questionNumber: "9.12",
        questionText:
          "Is there a plan for equitable treatment of heirs, including any illiquid or operating assets?",
        whyThisMatters:
          "Dividing illiquid assets unequally or unclearly breeds resentment and forced sales.",
        recommendedActions:
          "Design equalization strategies (insurance, buyouts, or tailored bequests).",
        answers: ["No plan", "Informal intent", "Plan defined", "Equalization strategies in place"],
      },
      {
        questionNumber: "9.13",
        questionText:
          "Are guardianship provisions for any minor children documented and current?",
        whyThisMatters:
          "Without valid guardianship provisions, a court decides who raises minor children.",
        recommendedActions:
          "Name guardians and successors, and revisit the choice as circumstances change.",
        answers: ["None", "Informal wishes", "Documented", "Documented and current"],
      },
      {
        questionNumber: "9.14",
        questionText:
          "Are provisions in place for beneficiaries with special needs or particular vulnerabilities?",
        whyThisMatters:
          "Direct inheritance can disqualify benefits or expose vulnerable heirs to harm.",
        recommendedActions:
          "Use special-needs trusts and protective structures where appropriate.",
        answers: ["None", "Considered", "In place", "Protective structures in place"],
      },
      {
        questionNumber: "9.15",
        questionText:
          "Are incentive or protective trust provisions considered for heirs who need additional structure?",
        whyThisMatters:
          "Unconstrained inheritance can harm unprepared or at-risk beneficiaries.",
        recommendedActions:
          "Consider staged or incentive-based distribution terms.",
        answers: ["Not considered", "Discussed", "Considered", "Structured where appropriate"],
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
        answers: ["None", "Unfunded agreement", "Agreement in place", "Executed and funded"],
      },
      {
        questionNumber: "9.17",
        questionText:
          "Is there a written management-succession plan naming and preparing successors for key roles?",
        whyThisMatters:
          "Businesses fail transitions without prepared, identified leadership.",
        recommendedActions:
          "Identify and develop successors well ahead of any transition.",
        answers: ["None", "Informal idea", "Written plan", "Plan with successors in development"],
      },
      {
        questionNumber: "9.18",
        questionText:
          "Is a current business valuation maintained for estate, tax, and transfer purposes?",
        whyThisMatters:
          "Stale valuations distort estate, buy-sell, and transfer outcomes.",
        recommendedActions:
          "Obtain periodic independent business valuations.",
        answers: ["None", "Outdated", "Periodic", "Regular independent valuations"],
      },
      {
        questionNumber: "9.19",
        questionText:
          "Are ownership-transfer mechanics (voting vs. non-voting interests, timelines) defined for the enterprise?",
        whyThisMatters:
          "Ambiguous transfer mechanics create control disputes among heirs.",
        recommendedActions:
          "Define transfer structure and control provisions in advance.",
        answers: ["Undefined", "Partly defined", "Defined", "Defined with control provisions"],
      },
      {
        questionNumber: "9.20",
        questionText:
          "Is key-person and business-continuity risk addressed with insurance or contingency plans?",
        whyThisMatters:
          "Loss of a key principal can cripple the enterprise and the estate that depends on it.",
        recommendedActions:
          "Insure key persons and document business-continuity plans.",
        answers: ["Unaddressed", "Partially addressed", "Addressed", "Insured with continuity plans"],
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
        answers: ["Undocumented", "Partial", "Documented", "Secure directory with legal authority"],
      },
      {
        questionNumber: "9.22",
        questionText:
          "Are cryptocurrency and other digital-asset holdings inventoried with secure succession access?",
        whyThisMatters:
          "Digital assets with lost keys are permanently unrecoverable by heirs.",
        recommendedActions:
          "Document holdings and secure key-recovery instructions for fiduciaries.",
        answers: ["No plan", "Aware", "Inventoried", "Inventoried with key recovery"],
      },
      {
        questionNumber: "9.23",
        questionText:
          "Is a consolidated inventory of assets, liabilities, and advisors maintained for executors?",
        whyThisMatters:
          "Executors waste months and money reconstructing an estate that was never inventoried.",
        recommendedActions:
          "Keep a current master inventory and share its location with fiduciaries.",
        answers: ["None", "Partial", "Maintained", "Current master inventory, shared"],
      },
      {
        questionNumber: "9.24",
        questionText:
          "Are important physical documents and records secured, with their location known to fiduciaries?",
        whyThisMatters:
          "Lost originals delay or invalidate estate actions.",
        recommendedActions:
          "Secure original documents and record their storage location.",
        answers: ["Scattered", "Partially secured", "Secured", "Secured with known location"],
      },
      {
        questionNumber: "9.25",
        questionText:
          "Is there explicit legal authority for fiduciaries to access digital and online accounts?",
        whyThisMatters:
          "Without granted authority, providers deny fiduciaries access to online accounts.",
        recommendedActions:
          "Include digital-asset authority in wills, trusts, and powers of attorney.",
        answers: ["None", "Unclear", "Granted", "Explicit authority in documents"],
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
        answers: ["Insufficient", "Uncertain", "Adequate", "Modeled and earmarked or insured"],
      },
      {
        questionNumber: "9.27",
        questionText:
          "Is life insurance used and structured (e.g., through an ILIT) appropriately for estate liquidity and transfer?",
        whyThisMatters:
          "Poorly structured insurance can add to the taxable estate rather than relieve it.",
        recommendedActions:
          "Review policy ownership and beneficiary structure with counsel.",
        answers: ["None or unstructured", "Owned personally", "Structured", "ILIT-structured for liquidity"],
      },
      {
        questionNumber: "9.28",
        questionText:
          "Are philanthropic and legacy intentions documented and integrated into the estate plan?",
        whyThisMatters:
          "Undocumented charitable intent is often lost or contested after death.",
        recommendedActions:
          "Formalize legacy goals in the plan and align giving vehicles to them.",
        answers: ["Undocumented", "Informal", "Documented", "Integrated with giving vehicles"],
      },
      {
        questionNumber: "9.29",
        questionText:
          "Have executors and fiduciaries been briefed on their roles and the location of key information?",
        whyThisMatters:
          "Unprepared fiduciaries mishandle or delay estate settlement.",
        recommendedActions:
          "Brief fiduciaries and provide an access roadmap to key information.",
        answers: ["Unaware", "Minimal briefing", "Briefed", "Briefed with access roadmap"],
      },
      {
        questionNumber: "9.30",
        questionText:
          "Is the overall estate plan coordinated across tax, investment, insurance, and legal advisors?",
        whyThisMatters:
          "Siloed advisors produce conflicting or duplicative estate strategies.",
        recommendedActions:
          "Coordinate the estate plan across the full advisory team.",
        answers: ["Siloed", "Loosely coordinated", "Coordinated", "Fully coordinated advisory team"],
      },
    ],
  },
  {
    categoryCode: "10_ai",
    categoryName: "AI & Emerging Tech Risk",
    sheetName: "AI Risk",
    displayOrder: 10,
    slug: "ai-emerging-tech",
    sectionCode: "A",
    sectionName: "Impersonation & deepfake fraud",
    questions: [
      {
        questionNumber: "10.1",
        questionText:
          "Are financial and wire-transfer requests verified through a second, out-of-band channel to defend against voice-clone and video deepfake fraud?",
        whyThisMatters:
          "Attackers can now clone a principal's voice or likeness to authorize fraudulent transfers.",
        recommendedActions:
          "Require call-back verification on a known number for any funds movement or sensitive request.",
        answers: ["No verification", "Informal call-back sometimes", "Call-back required", "Out-of-band verification enforced and tested"],
      },
      {
        questionNumber: "10.2",
        questionText:
          "Has the family established a private code word or phrase to confirm identity during urgent or high-value requests?",
        whyThisMatters:
          "A shared secret defeats AI impersonation that mimics a familiar voice or writing style.",
        recommendedActions:
          "Agree on a verification code word with family members and key staff.",
        answers: ["None", "Discussed only", "Established", "Established and periodically refreshed"],
      },
      {
        questionNumber: "10.3",
        questionText:
          "Are staff, advisors, and family trained to recognize AI-driven social engineering (deepfake calls, cloned emails)?",
        whyThisMatters:
          "Deepfake-enabled social engineering is now a leading vector for high-value fraud.",
        recommendedActions:
          "Run awareness training on AI impersonation for everyone with financial or access authority.",
        answers: ["No awareness", "Ad hoc warnings", "Trained", "Regular training with simulations"],
      },
      {
        questionNumber: "10.4",
        questionText:
          "Is there a verification protocol for changes to payment instructions or vendor bank details?",
        whyThisMatters:
          "AI-crafted business-email compromise reroutes payments with convincing forgeries.",
        recommendedActions:
          "Independently confirm any change to payment details before acting on it.",
        answers: ["No protocol", "Informal check", "Protocol in place", "Enforced dual verification"],
      },
      {
        questionNumber: "10.5",
        questionText:
          "Are principals aware that their public voice and video can be harvested to train impersonation models?",
        whyThisMatters:
          "Public speeches, interviews, and social clips are raw material for voice and video cloning.",
        recommendedActions:
          "Limit and monitor the public audio and video exposure of key principals.",
        answers: ["Unaware", "Some awareness", "Aware and cautious", "Managed with monitoring"],
      },
    ],
  },
  {
    categoryCode: "10_ai",
    categoryName: "AI & Emerging Tech Risk",
    sheetName: "AI Risk",
    displayOrder: 10,
    slug: "ai-emerging-tech",
    sectionCode: "B",
    sectionName: "Synthetic media & reputation",
    questions: [
      {
        questionNumber: "10.6",
        questionText:
          "Do you monitor for AI-generated fake content (images, video, articles) impersonating or misrepresenting the family?",
        whyThisMatters:
          "Synthetic media can fabricate statements or scandals that spread before they can be countered.",
        recommendedActions:
          "Deploy monitoring for deepfakes and synthetic content referencing the family.",
        answers: ["No monitoring", "Manual or occasional", "Active monitoring", "Real-time with alerting"],
      },
      {
        questionNumber: "10.7",
        questionText:
          "Is there a rapid-response plan for a synthetic-media reputational attack (a fake video or audio going viral)?",
        whyThisMatters:
          "The first hours determine whether a fabricated clip is contained or defines the narrative.",
        recommendedActions:
          "Prepare a takedown, verification, and communications playbook for synthetic-media incidents.",
        answers: ["None", "Informal", "Documented plan", "Documented, tested and resourced"],
      },
      {
        questionNumber: "10.8",
        questionText:
          "Can the family authenticate genuine communications to counter fabricated ones (signed statements, verified channels)?",
        whyThisMatters:
          "Provenance and verification let audiences distinguish real messages from AI forgeries.",
        recommendedActions:
          "Establish verified official channels and content-authentication practices.",
        answers: ["None", "Ad hoc", "Verified channels exist", "Provenance and authentication standardized"],
      },
      {
        questionNumber: "10.9",
        questionText:
          "Are PR and legal advisors in place who understand synthetic-media threats and cross-platform takedowns?",
        whyThisMatters:
          "Deepfake incidents need specialists who can act fast across platforms and jurisdictions.",
        recommendedActions:
          "Retain advisors experienced in synthetic-media response and platform takedowns.",
        answers: ["None", "Generalist only", "Specialist identified", "Specialist retained and briefed"],
      },
      {
        questionNumber: "10.10",
        questionText:
          "Is the family's digital likeness footprint (photos, voice, video) inventoried and its exposure managed?",
        whyThisMatters:
          "The larger the likeness footprint, the easier and more convincing impersonation becomes.",
        recommendedActions:
          "Inventory public likeness assets and reduce unnecessary exposure.",
        answers: ["Unknown", "Partial awareness", "Inventoried", "Inventoried and actively minimized"],
      },
    ],
  },
  {
    categoryCode: "10_ai",
    categoryName: "AI & Emerging Tech Risk",
    sheetName: "AI Risk",
    displayOrder: 10,
    slug: "ai-emerging-tech",
    sectionCode: "C",
    sectionName: "Data exposure to AI tools",
    questions: [
      {
        questionNumber: "10.11",
        questionText:
          "Is there a policy governing what family or office information may be entered into public AI tools (chatbots, assistants)?",
        whyThisMatters:
          "Sensitive data entered into public AI services can be retained, exposed, or used for training.",
        recommendedActions:
          "Set a clear policy on acceptable use of public AI tools and approved alternatives.",
        answers: ["No policy", "Informal caution", "Written policy", "Policy enforced with approved tools"],
      },
      {
        questionNumber: "10.12",
        questionText:
          "Are staff and advisors restricted from uploading confidential documents to unvetted AI services?",
        whyThisMatters:
          "Confidential financial, legal, and personal data leaks through unsanctioned AI uploads.",
        recommendedActions:
          "Restrict uploads to vetted, contractually protected AI services.",
        answers: ["Unrestricted", "Informal guidance", "Restricted", "Enforced with vetted tools only"],
      },
      {
        questionNumber: "10.13",
        questionText:
          "Do the AI vendors and tools used by the family office meet data-protection and confidentiality standards?",
        whyThisMatters:
          "AI vendors vary widely in data retention, training use, and security posture.",
        recommendedActions:
          "Vet AI vendors for data handling, retention, and no-training-on-your-data terms.",
        answers: ["Not assessed", "Basic check", "Assessed", "Contractually assured and reviewed"],
      },
      {
        questionNumber: "10.14",
        questionText:
          "Is sensitive personal data (health, financial, location) protected from being scraped into AI training datasets?",
        whyThisMatters:
          "Publicly exposed personal data is harvested at scale to profile and target wealthy families.",
        recommendedActions:
          "Minimize public exposure and pursue removal from data brokers and scrapers.",
        answers: ["Unprotected", "Some steps taken", "Protected", "Actively minimized and monitored"],
      },
      {
        questionNumber: "10.15",
        questionText:
          "Are AI features embedded in everyday apps and devices reviewed for privacy before use?",
        whyThisMatters:
          "Assistants and smart devices quietly capture conversations, locations, and documents.",
        recommendedActions:
          "Review and configure AI and assistant features on household devices for privacy.",
        answers: ["Never reviewed", "Rarely", "Reviewed", "Configured and periodically audited"],
      },
    ],
  },
  {
    categoryCode: "10_ai",
    categoryName: "AI & Emerging Tech Risk",
    sheetName: "AI Risk",
    displayOrder: 10,
    slug: "ai-emerging-tech",
    sectionCode: "D",
    sectionName: "AI in family-office operations & advice",
    questions: [
      {
        questionNumber: "10.16",
        questionText:
          "Where AI is used in investment research or decisions, are its outputs independently validated before acting?",
        whyThisMatters:
          "AI can produce confident but wrong or fabricated analysis that misguides large decisions.",
        recommendedActions:
          "Require human expert validation of any AI-influenced investment recommendation.",
        answers: ["No validation", "Occasional", "Validated", "Independent validation required"],
      },
      {
        questionNumber: "10.17",
        questionText:
          "Is there clear human oversight and accountability for any AI-assisted decisions in the family office?",
        whyThisMatters:
          "Unaccountable automation can execute errors at speed and scale.",
        recommendedActions:
          "Assign named human accountability for every AI-assisted process.",
        answers: ["None", "Unclear", "Defined", "Defined with audit trail"],
      },
      {
        questionNumber: "10.18",
        questionText:
          "Are AI tools used for accounting, reporting, or legal work checked for errors and hallucinations?",
        whyThisMatters:
          "AI-generated numbers, citations, and clauses can be plausibly but seriously wrong.",
        recommendedActions:
          "Review AI-produced work product against source data and expert judgment.",
        answers: ["Unchecked", "Spot checks", "Reviewed", "Systematically verified"],
      },
      {
        questionNumber: "10.19",
        questionText:
          "Is reliance on AI vendors assessed for concentration and business-continuity risk?",
        whyThisMatters:
          "Over-dependence on one AI provider creates operational and lock-in risk.",
        recommendedActions:
          "Avoid single-vendor dependence and plan for tool failure or withdrawal.",
        answers: ["Not considered", "Aware", "Assessed", "Diversified with contingency"],
      },
      {
        questionNumber: "10.20",
        questionText:
          "Are the biases and limitations of AI tools understood by those who rely on them?",
        whyThisMatters:
          "Blind trust in AI outputs embeds hidden bias and error into decisions.",
        recommendedActions:
          "Educate decision-makers on where AI tools are unreliable.",
        answers: ["Not understood", "Vaguely", "Understood", "Understood and documented in process"],
      },
    ],
  },
  {
    categoryCode: "10_ai",
    categoryName: "AI & Emerging Tech Risk",
    sheetName: "AI Risk",
    displayOrder: 10,
    slug: "ai-emerging-tech",
    sectionCode: "E",
    sectionName: "Household & next-generation AI exposure",
    questions: [
      {
        questionNumber: "10.21",
        questionText:
          "Are children and young family members guided on the safe use of AI tools and chatbots?",
        whyThisMatters:
          "Minors share sensitive family details with AI apps and are targets for manipulation.",
        recommendedActions:
          "Set household guidance and oversight for children's use of AI.",
        answers: ["No guidance", "Occasional talks", "Guidance in place", "Guidance with active oversight"],
      },
      {
        questionNumber: "10.22",
        questionText:
          "Is the family aware of AI-enabled scams targeting the young and elderly (romance, grandparent, investment)?",
        whyThisMatters:
          "AI makes these scams far more convincing and personalized.",
        recommendedActions:
          "Educate vulnerable family members on AI-enabled scam patterns.",
        answers: ["Unaware", "Some awareness", "Aware", "Educated and supported"],
      },
      {
        questionNumber: "10.23",
        questionText:
          "Are smart-home and AI-enabled devices in residences secured and privacy-configured?",
        whyThisMatters:
          "Cameras, assistants, and sensors can be exploited for surveillance or intrusion.",
        recommendedActions:
          "Harden and privacy-configure all smart-home and AI devices.",
        answers: ["Unsecured", "Partially", "Secured", "Secured, segmented and monitored"],
      },
      {
        questionNumber: "10.24",
        questionText:
          "Is exposure through wearables and AI health apps (location, biometrics, routines) understood and managed?",
        whyThisMatters:
          "Continuous personal data streams reveal patterns useful to fraudsters and physical threats.",
        recommendedActions:
          "Review data sharing on wearables and health apps and limit it where sensitive.",
        answers: ["Unmanaged", "Some awareness", "Managed", "Actively minimized"],
      },
      {
        questionNumber: "10.25",
        questionText:
          "Do family members understand how the data they share with AI apps could be used against them?",
        whyThisMatters:
          "Awareness is the first defense against oversharing with AI services.",
        recommendedActions:
          "Build household literacy on AI data risks.",
        answers: ["No understanding", "Limited", "Good understanding", "Strong, reinforced literacy"],
      },
    ],
  },
  {
    categoryCode: "10_ai",
    categoryName: "AI & Emerging Tech Risk",
    sheetName: "AI Risk",
    displayOrder: 10,
    slug: "ai-emerging-tech",
    sectionCode: "F",
    sectionName: "Governance, awareness & response",
    questions: [
      {
        questionNumber: "10.26",
        questionText:
          "Is there a designated owner (advisor or staff) responsible for tracking AI and emerging-tech risks?",
        whyThisMatters:
          "Fast-moving AI threats need someone accountable to watch and respond.",
        recommendedActions:
          "Assign ownership of AI and emerging-tech risk monitoring.",
        answers: ["No owner", "Informal", "Owner assigned", "Owner with a defined mandate"],
      },
      {
        questionNumber: "10.27",
        questionText:
          "Does the family stay informed on emerging AI threats relevant to high-net-worth individuals?",
        whyThisMatters:
          "The threat landscape shifts monthly, and static defenses fall behind.",
        recommendedActions:
          "Maintain a briefing cadence on emerging AI and tech threats.",
        answers: ["Not tracked", "Occasional", "Regular updates", "Structured intelligence cadence"],
      },
      {
        questionNumber: "10.28",
        questionText:
          "Is AI and emerging-tech risk integrated into the family's overall risk review and incident planning?",
        whyThisMatters:
          "Siloed AI concerns miss cross-cutting fraud, reputation, and privacy links.",
        recommendedActions:
          "Fold AI risk into the annual risk review and incident-response plans.",
        answers: ["Not integrated", "Loosely", "Integrated", "Fully integrated and tested"],
      },
      {
        questionNumber: "10.29",
        questionText:
          "Are AI-related incidents (attempted deepfake fraud, data leaks) logged and reviewed to improve defenses?",
        whyThisMatters:
          "Near-misses reveal where controls are weak before a costly breach.",
        recommendedActions:
          "Log AI incidents and near-misses and act on the patterns.",
        answers: ["Not logged", "Informally", "Logged", "Logged and drives improvements"],
      },
      {
        questionNumber: "10.30",
        questionText:
          "Is there a plan to adopt protective emerging technologies (content authentication, monitoring) as they mature?",
        whyThisMatters:
          "Defenses must evolve as fast as AI-enabled threats.",
        recommendedActions:
          "Track and deliberately adopt maturing protective technologies.",
        answers: ["No plan", "Reactive", "Planned", "Proactively adopted and reviewed"],
      },
    ],
  },
];

export { SCORED_0_3 };
