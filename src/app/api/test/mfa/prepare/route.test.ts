import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUserSpy, updateSpy, enrollSpy, enableSpy } = vi.hoisted(() => ({
  findUserSpy: vi.fn(),
  updateSpy: vi.fn(),
  enrollSpy: vi.fn(),
  enableSpy: vi.fn(),
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

vi.mock("@/lib/mfa", () => ({
  enrollMFA: (...args: unknown[]) => enrollSpy(...args),
  enableMFA: (...args: unknown[]) => enableSpy(...args),
}));

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { POST } from "./route";

beforeEach(() => {
  findUserSpy.mockReset();
  updateSpy.mockReset();
  enrollSpy.mockReset();
  enableSpy.mockReset();
  vi.mocked(isTestAuthEnabled).mockReturnValue(true);
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/test/mfa/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/test/mfa/prepare", () => {
  it("returns 404 when test auth is disabled", async () => {
    vi.mocked(isTestAuthEnabled).mockReturnValue(false);
    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for client (USER) role", async () => {
    findUserSpy.mockResolvedValue({ id: "u1", role: "USER" });
    const res = await POST(makeRequest({ email: "client@test.com" }));
    expect(res.status).toBe(404);
    expect(enrollSpy).not.toHaveBeenCalled();
  });

  it("resets MFA only when resetOnly is true", async () => {
    findUserSpy.mockResolvedValue({ id: "adv-1", role: "ADVISOR" });
    updateSpy.mockResolvedValue({});

    const res = await POST(
      makeRequest({ email: "advisor2@test.com", resetOnly: true })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ email: "advisor2@test.com", reset: true });
    expect(enrollSpy).not.toHaveBeenCalled();
    expect(enableSpy).not.toHaveBeenCalled();
  });

  it("resets MFA and returns secret + recovery codes for advisor", async () => {
    findUserSpy.mockResolvedValue({ id: "adv-1", role: "ADVISOR" });
    updateSpy.mockResolvedValue({});
    enrollSpy.mockResolvedValue({
      secret: "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD",
      qrCodeUrl: "x",
    });
    enableSpy.mockResolvedValue(["aaaa1111", "bbbb2222"]);

    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "adv-1" },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: null,
      },
    });
    expect(enrollSpy).toHaveBeenCalledWith("adv-1");
    expect(enableSpy).toHaveBeenCalledOnce();
    expect(body.secret).toBe("KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD");
    expect(body.recoveryCodes).toEqual(["aaaa1111", "bbbb2222"]);
  });
});
