import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManySpy, findUniqueSpy } = vi.hoisted(() => ({
  findManySpy: vi.fn(),
  findUniqueSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findMany: (...args: unknown[]) => findManySpy(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
    },
  },
}));

import { isMfaChallengePendingForUser } from "./mfa-session-status";

beforeEach(() => {
  findManySpy.mockReset();
  findUniqueSpy.mockReset();
});

describe("isMfaChallengePendingForUser", () => {
  it("returns false when MFA is disabled in the database", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(false);
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("returns false when JWT shows MFA enabled but database has it disabled", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(false);
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("returns false when database session is verified", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: true });
    findManySpy.mockResolvedValue([{ mfaVerified: true }]);

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(false);
    expect(findManySpy).toHaveBeenCalledOnce();
  });

  it("returns true when MFA is enabled and session is not verified", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: true });
    findManySpy.mockResolvedValue([{ mfaVerified: false }]);

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(true);
  });
});
