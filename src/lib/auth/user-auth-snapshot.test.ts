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

import { getUserAuthSnapshot } from "./user-auth-snapshot";

beforeEach(() => {
  findUniqueSpy.mockReset();
});

describe("getUserAuthSnapshot", () => {
  it("returns compliance fields when the schema is current", async () => {
    findUniqueSpy.mockResolvedValueOnce({
      mfaEnabled: true,
      role: "ADVISOR",
      firstName: "Ada",
      deletedAt: null,
      passwordChangeRequired: true,
      passwordPolicyRevision: 2,
    });

    await expect(getUserAuthSnapshot("user-1")).resolves.toEqual({
      mfaEnabled: true,
      role: "ADVISOR",
      firstName: "Ada",
      deletedAt: null,
      passwordChangeRequired: true,
      passwordPolicyRevision: 2,
    });
  });

  it("falls back safely when compliance columns are not migrated", async () => {
    findUniqueSpy
      .mockRejectedValueOnce({
        code: "P2022",
        message: 'The column "passwordChangeRequired" does not exist',
      })
      .mockResolvedValueOnce({
        mfaEnabled: false,
        role: "ADVISOR",
        firstName: null,
        deletedAt: null,
      });

    await expect(getUserAuthSnapshot("user-1")).resolves.toEqual({
      mfaEnabled: false,
      role: "ADVISOR",
      firstName: null,
      deletedAt: null,
      passwordChangeRequired: false,
      passwordPolicyRevision: 0,
    });
  });
});
