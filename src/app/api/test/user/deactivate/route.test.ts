import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUserSpy, updateSpy } = vi.hoisted(() => ({
  findUserSpy: vi.fn(),
  updateSpy: vi.fn(),
}));

vi.mock("@/lib/auth/test-auth-enabled", () => ({
  isTestAuthEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/auth/user-email", () => ({
  findUserByEmail: (...args: unknown[]) => findUserSpy(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => updateSpy(...args),
    },
  },
}));

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { POST } from "./route";

beforeEach(() => {
  findUserSpy.mockReset();
  updateSpy.mockReset();
  vi.mocked(isTestAuthEnabled).mockReturnValue(true);
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/test/user/deactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/test/user/deactivate", () => {
  it("returns 404 when test auth is disabled", async () => {
    vi.mocked(isTestAuthEnabled).mockReturnValue(false);
    const res = await POST(makeRequest({ email: "advisor2@test.com" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-test.com emails", async () => {
    const res = await POST(makeRequest({ email: "buddy@ebilly.com" }));
    expect(res.status).toBe(404);
    expect(findUserSpy).not.toHaveBeenCalled();
  });

  it("soft-deletes a test user", async () => {
    findUserSpy.mockResolvedValue({ id: "u-1" });
    updateSpy.mockResolvedValue({});

    const res = await POST(makeRequest({ email: "advisor2@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deactivated).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: {
        deletedAt: expect.any(Date),
        advisorPortalAccessEnabled: false,
      },
    });
  });

  it("restores a test user when restoreOnly is true", async () => {
    findUserSpy.mockResolvedValue({ id: "u-1" });
    updateSpy.mockResolvedValue({});

    const res = await POST(
      makeRequest({ email: "advisor2@test.com", restoreOnly: true })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.restored).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: {
        deletedAt: null,
        advisorPortalAccessEnabled: true,
      },
    });
  });
});
