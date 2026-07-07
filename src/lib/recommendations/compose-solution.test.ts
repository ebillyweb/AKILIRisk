import { describe, it, expect } from "vitest";
import { composeSolution } from "./compose-solution";
import type {
  ServiceRecommendation,
  EnterpriseSolutionCustomization,
  AdvisorSolutionCustomization,
} from "@prisma/client";

function makeService(
  overrides: Partial<ServiceRecommendation> = {}
): ServiceRecommendation {
  return {
    id: "svc-1",
    name: "Cyber Insurance Review",
    description: "Full cyber insurance posture review",
    shortDescription: "Review cyber coverage",
    category: "Insurance",
    priority: 1,
    estimatedCost: "$5,000",
    timeframe: "4 weeks",
    provider: "Akili Platform",
    metadata: null,
    isActive: true,
    tier: "BASELINE",
    complexity: "MEDIUM",
    implementationType: "ADVISORY",
    slug: "cyber-insurance-review",
    icon: "shield",
    expectedOutcome: "Comprehensive coverage gap analysis",
    tags: ["cyber", "insurance"],
    playbook: {
      steps: [
        { title: "Gather policies", description: "Collect existing policies", sortOrder: 0 },
        { title: "Gap analysis", description: "Identify coverage gaps", sortOrder: 1 },
      ],
    },
    externalUrl: null,
    prerequisites: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEnterpriseCustomization(
  overrides: Partial<EnterpriseSolutionCustomization> = {}
): EnterpriseSolutionCustomization {
  return {
    id: "ec-1",
    enterpriseId: "ent-1",
    serviceRecommendationId: "svc-1",
    costOverride: null,
    timeframeOverride: null,
    providerOverride: null,
    additionalPlaybook: null,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAdvisorCustomization(
  overrides: Partial<AdvisorSolutionCustomization> = {}
): AdvisorSolutionCustomization {
  return {
    id: "ac-1",
    advisorProfileId: "adv-1",
    serviceRecommendationId: "svc-1",
    costOverride: null,
    timeframeOverride: null,
    providerOverride: null,
    additionalPlaybook: null,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("composeSolution", () => {
  it("returns platform-only solution when no overlays", () => {
    const result = composeSolution({ service: makeService() });

    expect(result.name).toBe("Cyber Insurance Review");
    expect(result.estimatedCost).toBe("$5,000");
    expect(result.timeframe).toBe("4 weeks");
    expect(result.provider).toBe("Akili Platform");
    expect(result.playbook).toHaveLength(2);
    expect(result.playbook[0].source).toBe("PLATFORM");
    expect(result.notes).toHaveLength(0);
    expect(result.sourceLayer.platform).toBe(true);
    expect(result.sourceLayer.enterprise).toBeNull();
    expect(result.sourceLayer.advisor).toBeNull();
  });

  it("enterprise overlay overrides cost and appends playbook steps", () => {
    const result = composeSolution({
      service: makeService(),
      enterpriseCustomization: makeEnterpriseCustomization({
        costOverride: "$8,000",
        additionalPlaybook: {
          steps: [
            { title: "Firm compliance check", sortOrder: 2 },
          ],
        },
        notes: "Our firm requires additional compliance review.",
      }),
      enterpriseName: "Belvedere Wealth",
    });

    expect(result.estimatedCost).toBe("$8,000");
    expect(result.timeframe).toBe("4 weeks"); // inherited from platform
    expect(result.playbook).toHaveLength(3);
    expect(result.playbook[2].title).toBe("Firm compliance check");
    expect(result.playbook[2].source).toBe("ENTERPRISE");
    expect(result.notes).toEqual(["Our firm requires additional compliance review."]);
    expect(result.sourceLayer.enterprise).toEqual({
      id: "ent-1",
      name: "Belvedere Wealth",
    });
  });

  it("advisor overlay takes precedence over enterprise for scalar overrides", () => {
    const result = composeSolution({
      service: makeService(),
      enterpriseCustomization: makeEnterpriseCustomization({
        costOverride: "$8,000",
        providerOverride: "Enterprise Partner",
      }),
      advisorCustomization: makeAdvisorCustomization({
        costOverride: "$10,000",
        additionalPlaybook: {
          steps: [
            { title: "Advisor follow-up call", sortOrder: 3 },
          ],
        },
        notes: "I recommend premium coverage for this client.",
      }),
      enterpriseName: "Belvedere",
      advisorName: "Smith Advisors",
    });

    // Advisor cost wins over enterprise
    expect(result.estimatedCost).toBe("$10,000");
    // Enterprise provider wins (advisor didn't override)
    expect(result.provider).toBe("Enterprise Partner");
    // All three layers contribute playbook steps
    expect(result.playbook).toHaveLength(3); // 2 platform + 0 enterprise + 1 advisor
    expect(result.playbook[2].source).toBe("ADVISOR");
    expect(result.notes).toHaveLength(1); // only advisor had notes
    expect(result.sourceLayer.advisor).toEqual({
      id: "adv-1",
      name: "Smith Advisors",
    });
  });

  it("handles null/missing playbook gracefully", () => {
    const result = composeSolution({
      service: makeService({ playbook: null }),
    });

    expect(result.playbook).toHaveLength(0);
  });

  it("handles malformed playbook JSON gracefully", () => {
    const result = composeSolution({
      service: makeService({ playbook: { notSteps: true } }),
    });

    expect(result.playbook).toHaveLength(0);
  });

  it("sorts playbook steps by sortOrder across layers", () => {
    const result = composeSolution({
      service: makeService({
        playbook: {
          steps: [
            { title: "Platform step B", sortOrder: 2 },
            { title: "Platform step A", sortOrder: 0 },
          ],
        },
      }),
      enterpriseCustomization: makeEnterpriseCustomization({
        additionalPlaybook: {
          steps: [
            { title: "Enterprise step", sortOrder: 1 },
          ],
        },
      }),
    });

    expect(result.playbook.map((s) => s.title)).toEqual([
      "Platform step A",
      "Enterprise step",
      "Platform step B",
    ]);
  });

  it("inactive enterprise customization is fully excluded (no overrides, no playbook, no sourceLayer)", () => {
    const result = composeSolution({
      service: makeService(),
      enterpriseCustomization: makeEnterpriseCustomization({
        isActive: false,
        costOverride: "$99,999",
        additionalPlaybook: {
          steps: [{ title: "Should not appear", sortOrder: 5 }],
        },
        notes: "Should not appear",
      }),
      enterpriseName: "Inactive Firm",
    });

    expect(result.estimatedCost).toBe("$5,000"); // platform value, not override
    expect(result.playbook).toHaveLength(2); // platform only
    expect(result.notes).toHaveLength(0);
    expect(result.sourceLayer.enterprise).toBeNull();
  });

  it("inactive advisor customization is fully excluded", () => {
    const result = composeSolution({
      service: makeService(),
      advisorCustomization: makeAdvisorCustomization({
        isActive: false,
        costOverride: "$99,999",
        providerOverride: "Ghost Provider",
      }),
      advisorName: "Inactive Advisor",
    });

    expect(result.estimatedCost).toBe("$5,000");
    expect(result.provider).toBe("Akili Platform");
    expect(result.sourceLayer.advisor).toBeNull();
  });

  it("uses stable tiebreaker when sortOrder collides across layers", () => {
    const result = composeSolution({
      service: makeService({
        playbook: {
          steps: [{ title: "Platform", sortOrder: 1 }],
        },
      }),
      enterpriseCustomization: makeEnterpriseCustomization({
        additionalPlaybook: {
          steps: [{ title: "Enterprise", sortOrder: 1 }],
        },
      }),
      advisorCustomization: makeAdvisorCustomization({
        additionalPlaybook: {
          steps: [{ title: "Advisor", sortOrder: 1 }],
        },
      }),
    });

    // Same sortOrder: platform < enterprise < advisor
    expect(result.playbook.map((s) => s.title)).toEqual([
      "Platform",
      "Enterprise",
      "Advisor",
    ]);
  });

  it("handles empty playbook steps array", () => {
    const result = composeSolution({
      service: makeService({ playbook: { steps: [] } }),
    });

    expect(result.playbook).toHaveLength(0);
  });

  it("filters out playbook steps without a title", () => {
    const result = composeSolution({
      service: makeService({
        playbook: {
          steps: [
            { title: "Valid step", sortOrder: 0 },
            { description: "Missing title", sortOrder: 1 },
            { title: "", sortOrder: 2 },
          ],
        },
      }),
    });

    // Empty string title passes the typeof check, only missing title is filtered
    expect(result.playbook).toHaveLength(2);
  });
});
