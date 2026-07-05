import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirstMock, resolveContextMock, isEnabledMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  resolveContextMock: vi.fn(),
  isEnabledMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findFirst: findFirstMock,
    },
  },
}));

vi.mock("@/lib/enterprise/advisor-member-visibility", () => ({
  resolveEnterpriseMemberVisibilityContext: resolveContextMock,
  isEnterpriseDocumentRequirementsWorkspaceEnabled: isEnabledMock,
}));

import { isClientDocumentRequirementsEnabledForUser } from "./client-document-requirements-visibility.server";

describe("isClientDocumentRequirementsEnabledForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to enabled when there is no active assignment", async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(
      isClientDocumentRequirementsEnabledForUser("client-1"),
    ).resolves.toBe(true);
    expect(resolveContextMock).not.toHaveBeenCalled();
  });

  it("follows the assigned advisor firm document-requirements toggle", async () => {
    findFirstMock.mockResolvedValue({
      advisor: { userId: "advisor-1" },
    });
    resolveContextMock.mockResolvedValue({ settings: { documentRequirements: false } });
    isEnabledMock.mockReturnValue(false);

    await expect(
      isClientDocumentRequirementsEnabledForUser("client-1"),
    ).resolves.toBe(false);
    expect(resolveContextMock).toHaveBeenCalledWith("advisor-1");
    expect(isEnabledMock).toHaveBeenCalledWith({
      settings: { documentRequirements: false },
    });
  });
});
