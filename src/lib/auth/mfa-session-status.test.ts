import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManySpy } = vi.hoisted(() => ({
  findManySpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findMany: (...args: unknown[]) => findManySpy(...args),
    },
  },
}));

import { isMfaChallengePendingForUser } from "./mfa-session-status";

beforeEach(() => {
  findManySpy.mockReset();
});

describe("isMfaChallengePendingForUser", () => {
  it("returns false when MFA is disabled", async () => {
    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: false,
      mfaVerified: false,
    });
    expect(pending).toBe(false);
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("returns false when JWT already shows verified", async () => {
    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: true,
    });
    expect(pending).toBe(false);
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("returns false when JWT is stale but DB session is verified", async () => {
    findManySpy.mockResolvedValue([{ mfaVerified: true }]);

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(false);
    expect(findManySpy).toHaveBeenCalledOnce();
  });

  it("returns true when JWT and DB both show pending", async () => {
    findManySpy.mockResolvedValue([{ mfaVerified: false }]);

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(true);
  });
});
