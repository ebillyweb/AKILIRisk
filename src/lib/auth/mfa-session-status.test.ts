import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueSpy } = vi.hoisted(() => ({
  findUniqueSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
    },
  },
}));

import { isMfaChallengePendingForUser } from "./mfa-session-status";

beforeEach(() => {
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
  });

  it("returns false when JWT shows MFA enabled but database has it disabled", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(false);
  });

  it("returns false when the bound-session claim is verified", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: true });

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: true,
    });

    expect(pending).toBe(false);
  });

  it("returns true when MFA is enabled and the bound-session claim is not verified", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: true });

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
      mfaVerified: false,
    });

    expect(pending).toBe(true);
  });

  it("fails closed when MFA is enabled and the claim omits mfaVerified", async () => {
    findUniqueSpy.mockResolvedValue({ mfaEnabled: true });

    const pending = await isMfaChallengePendingForUser({
      id: "u1",
      mfaEnabled: true,
    });

    expect(pending).toBe(true);
  });
});
