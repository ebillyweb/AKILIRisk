import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  findManySpy,
  findUniqueSpy,
  updateSpy,
  createSpy,
  deleteManySpy,
  userUpdateSpy,
} = vi.hoisted(() => ({
  findManySpy: vi.fn(),
  findUniqueSpy: vi.fn(),
  updateSpy: vi.fn(),
  createSpy: vi.fn(),
  deleteManySpy: vi.fn(),
  userUpdateSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findMany: (...args: unknown[]) => findManySpy(...args),
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
      update: (...args: unknown[]) => updateSpy(...args),
      create: (...args: unknown[]) => createSpy(...args),
      deleteMany: (...args: unknown[]) => deleteManySpy(...args),
    },
    user: {
      update: (...args: unknown[]) => userUpdateSpy(...args),
    },
  },
}));

import { markSessionMfaVerified, disableMFA } from "./mfa";

beforeEach(() => {
  findManySpy.mockReset();
  findUniqueSpy.mockReset();
  updateSpy.mockReset();
  createSpy.mockReset();
  deleteManySpy.mockReset();
  userUpdateSpy.mockReset();
  userUpdateSpy.mockResolvedValue({});
  deleteManySpy.mockResolvedValue({ count: 0 });
});

describe("markSessionMfaVerified", () => {
  it("updates the most recent active session when one exists", async () => {
    findManySpy.mockResolvedValue([{ id: "sess-1" }]);
    updateSpy.mockResolvedValue({});

    await markSessionMfaVerified("user-1");

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { mfaVerified: true },
    });
    expect(userUpdateSpy).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("creates a session row when none is active", async () => {
    findManySpy.mockResolvedValue([]);
    createSpy.mockResolvedValue({});

    await markSessionMfaVerified("user-2");

    expect(createSpy).toHaveBeenCalledOnce();
    const data = createSpy.mock.calls[0][0].data;
    expect(data.userId).toBe("user-2");
    expect(data.mfaVerified).toBe(true);
    expect(typeof data.sessionToken).toBe("string");
    expect(data.sessionToken.length).toBeGreaterThan(0);
    expect(userUpdateSpy).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it("updates the bound session row when sessionToken is supplied", async () => {
    findUniqueSpy.mockResolvedValue({ id: "sess-bound", userId: "user-1" });
    updateSpy.mockResolvedValue({});

    await markSessionMfaVerified("user-1", "token-abc");

    expect(findUniqueSpy).toHaveBeenCalledWith({
      where: { sessionToken: "token-abc" },
      select: { id: true, userId: true },
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "sess-bound" },
      data: { mfaVerified: true },
    });
    // Bound path short-circuits the newest-row fallback.
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("falls back to newest row when the bound token belongs to another user", async () => {
    findUniqueSpy.mockResolvedValue({ id: "sess-other", userId: "intruder" });
    findManySpy.mockResolvedValue([{ id: "sess-newest" }]);
    updateSpy.mockResolvedValue({});

    await markSessionMfaVerified("user-1", "token-mismatch");

    expect(findManySpy).toHaveBeenCalledOnce();
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "sess-newest" },
      data: { mfaVerified: true },
    });
  });
});

describe("disableMFA", () => {
  it("clears MFA fields and deletes the user's session rows", async () => {
    userUpdateSpy.mockResolvedValue({});

    await disableMFA("user-1");

    const updateCall = userUpdateSpy.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "user-1" });
    expect(updateCall.data.mfaEnabled).toBe(false);
    expect(updateCall.data.mfaSecret).toBeNull();
    // mfaRecoveryCodes is cleared via Prisma.DbNull (a sentinel object).
    expect(updateCall.data.mfaRecoveryCodes).toBeDefined();

    expect(deleteManySpy).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
