import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueSpy, updateSpy } = vi.hoisted(() => ({
  findUniqueSpy: vi.fn(),
  updateSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
      update: (...args: unknown[]) => updateSpy(...args),
    },
  },
}));

import crypto from "crypto";
import { verifyRecoveryCode } from "./mfa";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

beforeEach(() => {
  findUniqueSpy.mockReset();
  updateSpy.mockReset();
});

describe("verifyRecoveryCode", () => {
  it("consumes a valid recovery code on first use", async () => {
    const code = "a1b2c3d4";
    const hash = hashCode(code);
    findUniqueSpy.mockResolvedValue({ mfaRecoveryCodes: [hash, hashCode("other1")] });
    updateSpy.mockResolvedValue({});

    const ok = await verifyRecoveryCode("user-1", code);

    expect(ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { mfaRecoveryCodes: [hashCode("other1")] },
    });
  });

  it("rejects reuse of the same recovery code", async () => {
    findUniqueSpy.mockResolvedValue({ mfaRecoveryCodes: [hashCode("other1")] });

    const ok = await verifyRecoveryCode("user-1", "a1b2c3d4");

    expect(ok).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
