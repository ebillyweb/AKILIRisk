import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindPortfolio = vi.fn();
const mockResolveScope = vi.fn();
const mockGetAdvisorProfile = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    facilitatedSession: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    assessment: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/facilitated/session-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facilitated/session-access")>();
  return {
    ...actual,
    getFacilitatedSessionForAdvisor: vi.fn(),
  };
});

vi.mock("@/lib/enterprise/portfolio-access", () => ({
  resolvePortfolioScope: (...args: unknown[]) => mockResolveScope(...args),
  findPortfolioAssignmentForClient: (...args: unknown[]) => mockFindPortfolio(...args),
}));

vi.mock("@/lib/advisor/auth", () => ({
  getAdvisorProfileOrThrow: (...args: unknown[]) => mockGetAdvisorProfile(...args),
  requireAdvisorRole: vi.fn(),
}));

import { getFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";
import { authorizeAssessmentApiAccess } from "@/lib/facilitated/assessment-access";

describe("authorizeAssessmentApiAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows client owner", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      userId: "client-1",
    } as never);

    const access = await authorizeAssessmentApiAccess({
      assessmentId: "asmt-1",
      userId: "client-1",
      userRole: "USER",
    });

    expect(access).toEqual({ clientId: "client-1", isFacilitated: false });
  });

  it("allows advisor via facilitated session", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      userId: "client-1",
    } as never);

    vi.mocked(getFacilitatedSessionForAdvisor).mockResolvedValue({
      id: "sess-1",
      clientId: "client-1",
      advisorProfileId: "adv-1",
      status: "ASSESSMENT",
      interviewId: "int-1",
      assessmentId: "asmt-1",
      startedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
      client: { id: "client-1", name: "Client", emailCiphertext: "x" },
    });

    const access = await authorizeAssessmentApiAccess({
      assessmentId: "asmt-1",
      userId: "advisor-1",
      userRole: "ADVISOR",
      facilitatedSessionId: "sess-1",
    });

    expect(access?.isFacilitated).toBe(true);
    expect(access?.clientId).toBe("client-1");
  });

  it("denies cross-tenant probe", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      userId: "client-1",
    } as never);
    vi.mocked(getFacilitatedSessionForAdvisor).mockResolvedValue(null);

    const access = await authorizeAssessmentApiAccess({
      assessmentId: "asmt-1",
      userId: "advisor-other",
      userRole: "ADVISOR",
      facilitatedSessionId: "sess-1",
    });

    expect(access).toBeNull();
  });
});

describe("getFacilitatedSessionForAdvisor", () => {
  it("is re-exported for session access tests via integration", () => {
    expect(getFacilitatedSessionForAdvisor).toBeDefined();
  });
});
