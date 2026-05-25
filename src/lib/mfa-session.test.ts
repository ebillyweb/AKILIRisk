import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  findManySpy,
  updateSpy,
  createSpy,
} = vi.hoisted(() => ({
  findManySpy: vi.fn(),
  updateSpy: vi.fn(),
  createSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findMany: (...args: unknown[]) => findManySpy(...args),
      update: (...args: unknown[]) => updateSpy(...args),
      create: (...args: unknown[]) => createSpy(...args),
    },
  },
}));

import { markSessionMfaVerified } from "./mfa";

beforeEach(() => {
  findManySpy.mockReset();
  updateSpy.mockReset();
  createSpy.mockReset();
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
  });
});
