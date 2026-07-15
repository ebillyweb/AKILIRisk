/**
 * Phase 0 eval golden set.
 *
 * Representative assessment inputs spanning pillars and severity, each paired
 * with a reference "good" narrative. The reference is used to (a) prove the
 * rubric rewards grounded, specific output, and (b) anchor an LLM judge if one
 * is wired in. When the real generator exists, run it on each `input` and score
 * with the same rubric.
 */

import type { NarrativeInput, NarrativeOutput } from "../shape-a-prompt";

export type GoldenCase = {
  id: string;
  description: string;
  input: NarrativeInput;
  /** A strong, grounded reference output for this input. */
  referenceGood: NarrativeOutput;
};

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "ai-critical-two-services",
    description: "AI & Emerging Tech Risk, critical score, two selected services.",
    input: {
      pillar: { slug: "ai-emerging-tech", name: "AI & Emerging Tech Risk", score: 0.7, riskLevel: "critical" },
      household: { size: 5, hasOperatingBusiness: true, hasMinors: true },
      weakFindings: [
        {
          questionNumber: "10.1",
          questionText:
            "Are financial and wire-transfer requests verified through a second, out-of-band channel to defend against voice-clone and video deepfake fraud?",
          chosenLevel: 0,
          chosenLabel: "No verification",
          maturityAnchors: [
            "No verification",
            "Informal call-back sometimes",
            "Call-back required",
            "Out-of-band verification enforced and tested",
          ],
        },
        {
          questionNumber: "10.11",
          questionText:
            "Is there a policy governing what family or office information may be entered into public AI tools?",
          chosenLevel: 1,
          chosenLabel: "Informal caution",
          maturityAnchors: ["No policy", "Informal caution", "Written policy", "Policy enforced with approved tools"],
        },
      ],
      selectedServices: [
        {
          serviceId: "ai_impersonation_defense",
          name: "AI Impersonation & Deepfake Defense Program",
          description:
            "Out-of-band verification protocols, family code words, and staff training to defend against deepfake and voice-clone fraud.",
        },
        {
          serviceId: "ai_data_governance",
          name: "AI Tool Data Governance Program",
          description:
            "Acceptable-use policy, vendor vetting, and upload controls governing what family and office data may be entered into AI tools.",
        },
      ],
    },
    referenceGood: {
      pillarSummary:
        "Your household is exposed on the two highest-impact AI risks: unverified financial requests and ungoverned AI-tool use. Both are addressable with process changes rather than technology spend.",
      recommendations: [
        {
          serviceId: "ai_impersonation_defense",
          headline: "Close the wire-transfer verification gap",
          rationale:
            "You indicated financial and wire requests are not verified through a second channel, which is exactly the gap deepfake and voice-clone fraud exploits against families with an operating business. Verification protocols and a family code word remove that single point of failure.",
          tailoredActions: [
            "Require out-of-band call-back on a known number for any funds movement",
            "Agree a family verification code word with principals and key staff",
            "Train everyone with payment authority to recognize AI impersonation",
          ],
          citedFindings: ["10.1"],
          confidence: "high",
        },
        {
          serviceId: "ai_data_governance",
          headline: "Formalize AI-tool data handling",
          rationale:
            "Your AI-tool use is governed only by informal caution, so sensitive family and office information can be entered into public services without controls. A written acceptable-use policy with vetted tools closes that leakage path.",
          tailoredActions: [
            "Adopt a written acceptable-use policy for public AI tools",
            "Vet AI vendors for data retention and no-training terms",
          ],
          citedFindings: ["10.11"],
          confidence: "high",
        },
      ],
    },
  },
  {
    id: "governance-high-three-services",
    description: "Governance, high risk, three selected services (non-AI pillar).",
    input: {
      pillar: { slug: "governance", name: "Governance & Decision-Making", score: 0.9, riskLevel: "high" },
      household: { size: 6, hasOperatingBusiness: true },
      weakFindings: [
        {
          questionNumber: "A2",
          questionText: "Have you established a family governance structure (council, board, or advisory committee)?",
          chosenLevel: 0,
          chosenLabel: "None",
          maturityAnchors: ["None", "Informal", "Established", "Active and documented"],
        },
        {
          questionNumber: "A5",
          questionText: "Are external advisors engaged and coordinated for family governance matters?",
          chosenLevel: 0,
          chosenLabel: "None",
          maturityAnchors: ["None", "Reactive", "Engaged", "Fully integrated advisory team"],
        },
        {
          questionNumber: "A3",
          questionText: "Does the family hold regular governance meetings with agendas and minutes?",
          chosenLevel: 0,
          chosenLabel: "Never",
          maturityAnchors: ["Never", "Inconsistent", "Regular", "Regular with agendas and minutes"],
        },
      ],
      selectedServices: [
        {
          serviceId: "governance_family_charter",
          name: "Family Charter Development",
          description: "Establish a written family charter, governance body, and shared decision standards.",
        },
        {
          serviceId: "governance_advisor_coordination",
          name: "Advisor Coordination",
          description: "Coordinate legal, financial, and risk advisors around family governance.",
        },
        {
          serviceId: "governance_succession_planning",
          name: "Next-Generation Preparation",
          description: "Prepare the rising generation for governance responsibilities.",
        },
      ],
    },
    referenceGood: {
      pillarSummary:
        "Governance for your family is largely informal — no governance body, no coordinated advisors, and no regular meeting cadence — which drives decision risk as the enterprise grows. The steps below establish structure without over-engineering it.",
      recommendations: [
        {
          serviceId: "governance_family_charter",
          headline: "Stand up a governance body and charter",
          rationale:
            "You reported no established family governance structure, so authority and decision standards are undefined. A written charter and a governance body give decisions a durable home.",
          tailoredActions: [
            "Draft a family charter defining values and decision rights",
            "Form a family council or advisory committee",
          ],
          citedFindings: ["A2"],
          confidence: "high",
        },
        {
          serviceId: "governance_advisor_coordination",
          headline: "Coordinate your outside advisors",
          rationale:
            "External advisors are not engaged or coordinated on governance matters, leaving blind spots and duplicated effort. A coordinated advisory team closes those gaps.",
          tailoredActions: [
            "Convene an annual joint session with legal, financial, and risk advisors",
            "Assign an owner to coordinate advisor input",
          ],
          citedFindings: ["A5"],
          confidence: "high",
        },
        {
          serviceId: "governance_succession_planning",
          headline: "Prepare the rising generation",
          rationale:
            "Without regular governance meetings, the next generation has little structured exposure to how decisions are made. A preparation program builds that readiness over time.",
          tailoredActions: [
            "Introduce rising-generation members to governance meetings",
            "Build an age-appropriate education path",
          ],
          citedFindings: ["A3"],
          confidence: "medium",
        },
      ],
    },
  },
  {
    id: "ai-thin-findings-single-service",
    description: "Thin signal — one moderate finding, single service. Should read as measured, not overclaimed.",
    input: {
      pillar: { slug: "ai-emerging-tech", name: "AI & Emerging Tech Risk", score: 1.6, riskLevel: "medium" },
      household: { size: 2 },
      weakFindings: [
        {
          questionNumber: "10.26",
          questionText: "Is there a designated owner responsible for tracking AI and emerging-tech risks?",
          chosenLevel: 1,
          chosenLabel: "Informal",
          maturityAnchors: ["No owner", "Informal", "Owner assigned", "Owner with a defined mandate"],
        },
      ],
      selectedServices: [
        {
          serviceId: "ai_risk_governance",
          name: "AI Risk Governance & Incident Response",
          description:
            "Assigns ownership of AI-risk monitoring, integrates AI risk into the family's risk review, and establishes incident logging and response.",
        },
      ],
    },
    referenceGood: {
      pillarSummary:
        "Your AI-risk posture is moderate overall, with the main gap being clear ownership — AI-risk tracking is handled only informally today.",
      recommendations: [
        {
          serviceId: "ai_risk_governance",
          headline: "Assign clear ownership of AI risk",
          rationale:
            "You indicated AI-risk tracking is handled informally, with no designated owner, so emerging threats can go unmonitored. Naming an owner and integrating AI risk into your regular review closes that gap.",
          tailoredActions: [
            "Designate an owner for AI and emerging-tech risk monitoring",
            "Add AI risk to the annual risk review agenda",
          ],
          citedFindings: ["10.26"],
          confidence: "medium",
        },
      ],
    },
  },
];
