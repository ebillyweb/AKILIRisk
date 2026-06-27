import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    enterpriseSolutionCustomization: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: vi.fn(),
  advisorHubActionErrorMessage: vi.fn(
    (_err: unknown, fallback: string) => fallback
  ),
}));

vi.mock("@/lib/enterprise/team-access", () => ({
  requireEnterpriseTeamManager: vi.fn(),
}));

// Mock override policy
vi.mock("@/lib/recommendations/override-policy", () => ({
  validateOverlayFields: vi.fn(),
}));

// Mock revalidation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { validateOverlayFields } from "@/lib/recommendations/override-policy";
import {
  upsertEnterpriseOverlay,
  getEnterpriseOverlays,
} from "./enterprise-solution-actions";

const mockPrisma = vi.mocked(prisma);
const mockRequireAdvisorRole = vi.mocked(requireAdvisorRole);
const mockRequireTeam = vi.mocked(requireEnterpriseTeamManager);
const mockValidateFields = vi.mocked(validateOverlayFields);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdvisorRole.mockResolvedValue({
    userId: "advisor-user-1",
    role: "ADVISOR",
    email: "advisor@test.com",
  });
  mockRequireTeam.mockResolvedValue({
    enterpriseId: "enterprise-1",
    enterpriseName: "Acme Corp",
    role: "OWNER" as never,
    advisorProfileId: "advisor-profile-1",
  });
});

describe("upsertEnterpriseOverlay", () => {
  it("rejects when validateOverlayFields reports rejected fields", async () => {
    mockValidateFields.mockReturnValue({
      allowed: ["costOverride"],
      rejected: ["name", "description"],
    });

    const result = await upsertEnterpriseOverlay({
      serviceRecommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      costOverride: "$500",
      // These would be rejected by policy but we test via the mock
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("protected fields");
      expect(result.error).toContain("name");
      expect(result.error).toContain("description");
    }
    expect(
      mockPrisma.enterpriseSolutionCustomization.upsert
    ).not.toHaveBeenCalled();
  });

  it("scopes upsert to team.enterpriseId", async () => {
    mockValidateFields.mockReturnValue({
      allowed: ["costOverride", "notes"],
      rejected: [],
    });
    mockPrisma.enterpriseSolutionCustomization.upsert.mockResolvedValue({
      id: "overlay-1",
    } as never);

    const result = await upsertEnterpriseOverlay({
      serviceRecommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      costOverride: "$500",
      notes: "Internal guidance",
    });

    expect(result.success).toBe(true);
    expect(
      mockPrisma.enterpriseSolutionCustomization.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          enterpriseId_serviceRecommendationId: {
            enterpriseId: "enterprise-1",
            serviceRecommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
          },
        },
        create: expect.objectContaining({
          enterpriseId: "enterprise-1",
          serviceRecommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        }),
      })
    );
  });
});

describe("getEnterpriseOverlays", () => {
  it("scopes query to authenticated enterprise", async () => {
    mockPrisma.enterpriseSolutionCustomization.findMany.mockResolvedValue(
      [] as never
    );

    const result = await getEnterpriseOverlays();

    expect(result.success).toBe(true);
    expect(
      mockPrisma.enterpriseSolutionCustomization.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enterpriseId: "enterprise-1" },
      })
    );
  });
});
