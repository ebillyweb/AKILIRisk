import { describe, it, expect } from "vitest";
import {
  buildNarrativeSchema,
  renderNarrativeUserMessage,
  validateNarrativeOutput,
  type NarrativeInput,
  type NarrativeOutput,
} from "./shape-a-prompt";

// Realistic AI & Emerging Tech Risk input: two weak findings + two selected services.
const input: NarrativeInput = {
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
      maturityAnchors: [
        "No policy",
        "Informal caution",
        "Written policy",
        "Policy enforced with approved tools",
      ],
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
  firm: { name: "Belvedere", tone: "measured" },
};

const goodOutput: NarrativeOutput = {
  pillarSummary:
    "Your household is currently exposed on the two highest-impact AI risks: unverified financial requests and ungoverned use of AI tools. Both are addressable with process changes rather than technology spend.",
  recommendations: [
    {
      serviceId: "ai_impersonation_defense",
      headline: "Close the wire-transfer verification gap",
      rationale:
        "You indicated that financial and wire requests are not verified through a second channel, which is the exact gap deepfake and voice-clone fraud exploits against families with an operating business. A verification protocol and family code word remove the single point of failure.",
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
        "Your use of AI tools is governed only by informal caution, so sensitive family and office information can be entered into public services without controls. A written acceptable-use policy with vetted tools closes that leakage path.",
      tailoredActions: [
        "Adopt a written acceptable-use policy for public AI tools",
        "Vet AI vendors for data retention and no-training terms",
      ],
      citedFindings: ["10.11"],
      confidence: "high",
    },
  ],
};

describe("Shape A — narrative schema", () => {
  it("pins the serviceId enum to exactly the selected services", () => {
    const schema = buildNarrativeSchema(input.selectedServices.map((s) => s.serviceId));
    const enumVals = (schema.schema.properties.recommendations.items.properties.serviceId as { enum: string[] }).enum;
    expect(enumVals).toEqual(["ai_impersonation_defense", "ai_data_governance"]);
    expect(schema.strict).toBe(true);
  });

  it("renders a grounded, structured user message", () => {
    const msg = renderNarrativeUserMessage(input);
    expect(msg).toContain("ai_impersonation_defense");
    expect(msg).toContain("10.1");
    expect(msg).toContain("No verification");
    // No client identity is sent.
    expect(msg).not.toMatch(/email|@|street|ssn/i);
  });
});

describe("Shape A — grounding validator", () => {
  it("passes a well-grounded output", () => {
    expect(validateNarrativeOutput(goodOutput, input)).toEqual({ ok: true, reasons: [] });
  });

  it("rejects a hallucinated serviceId", () => {
    const bad: NarrativeOutput = {
      ...goodOutput,
      recommendations: [
        { ...goodOutput.recommendations[0], serviceId: "ai_totally_made_up" },
        goodOutput.recommendations[1],
      ],
    };
    const res = validateNarrativeOutput(bad, input);
    expect(res.ok).toBe(false);
    expect(res.reasons.some((r) => r.includes("Hallucinated serviceId"))).toBe(true);
  });

  it("rejects fabricated figures and guarantees", () => {
    const bad: NarrativeOutput = {
      ...goodOutput,
      recommendations: [
        {
          ...goodOutput.recommendations[0],
          rationale: "This will eliminate 90% of fraud and costs about $25,000.",
        },
        goodOutput.recommendations[1],
      ],
    };
    const res = validateNarrativeOutput(bad, input);
    expect(res.ok).toBe(false);
    expect(res.reasons.some((r) => r.includes("forbidden figure/guarantee"))).toBe(true);
  });

  it("flags a missing recommendation for a selected service", () => {
    const bad: NarrativeOutput = { ...goodOutput, recommendations: [goodOutput.recommendations[0]] };
    const res = validateNarrativeOutput(bad, input);
    expect(res.ok).toBe(false);
    expect(res.reasons.some((r) => r.includes("Missing recommendation"))).toBe(true);
  });

  it("flags high confidence with no cited findings", () => {
    const bad: NarrativeOutput = {
      ...goodOutput,
      recommendations: [
        { ...goodOutput.recommendations[0], citedFindings: [], confidence: "high" },
        goodOutput.recommendations[1],
      ],
    };
    const res = validateNarrativeOutput(bad, input);
    expect(res.ok).toBe(false);
    expect(res.reasons.some((r) => r.includes("high confidence with no cited findings"))).toBe(true);
  });
});
