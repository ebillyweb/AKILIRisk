import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/enterprise/portfolio-access", () => ({
  resolvePortfolioScope: vi.fn(),
  findPortfolioAssignmentForClient: vi.fn(),
}));

import {
  findPortfolioAssignmentForClient,
  resolvePortfolioScope,
} from "@/lib/enterprise/portfolio-access";
import { resolveIntakeAudioStreamAccess } from "./audio-stream-access";

const mockResolvePortfolioScope = vi.mocked(resolvePortfolioScope);
const mockFindPortfolioAssignmentForClient = vi.mocked(
  findPortfolioAssignmentForClient
);

describe("resolveIntakeAudioStreamAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the intake owner", async () => {
    await expect(
      resolveIntakeAudioStreamAccess({
        sessionUserId: "client-1",
        sessionRole: "USER",
        ownerUserId: "client-1",
      })
    ).resolves.toBe("owner");
  });

  it("allows platform admins without an advisor assignment", async () => {
    await expect(
      resolveIntakeAudioStreamAccess({
        sessionUserId: "admin-1",
        sessionRole: "ADMIN",
        ownerUserId: "client-1",
      })
    ).resolves.toBe("platform_admin");

    expect(mockResolvePortfolioScope).not.toHaveBeenCalled();
  });

  it("allows portfolio-scoped advisors", async () => {
    mockResolvePortfolioScope.mockResolvedValue({
      mode: "firm",
      enterpriseId: "ent-1",
      advisorProfileId: "adv-profile-1",
      role: "OWNER",
    });
    mockFindPortfolioAssignmentForClient.mockResolvedValue({
      assignmentAdvisorProfileId: "adv-profile-2",
    });

    await expect(
      resolveIntakeAudioStreamAccess({
        sessionUserId: "owner-user",
        sessionRole: "ADVISOR",
        ownerUserId: "client-1",
      })
    ).resolves.toBe("portfolio_advisor");
  });

  it("denies advisors outside the client portfolio", async () => {
    mockResolvePortfolioScope.mockResolvedValue({
      mode: "assigned",
      advisorProfileId: "adv-profile-1",
      enterpriseId: null,
      role: null,
    });
    mockFindPortfolioAssignmentForClient.mockResolvedValue(null);

    await expect(
      resolveIntakeAudioStreamAccess({
        sessionUserId: "other-advisor",
        sessionRole: "ADVISOR",
        ownerUserId: "client-1",
      })
    ).resolves.toBeNull();
  });
});
