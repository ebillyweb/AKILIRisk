import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  authSpy,
  verifyTokenSpy,
  verifyRecoverySpy,
  disableSpy,
  findUniqueSpy,
  rateLimitSpy,
  writeAuditSpy,
} = vi.hoisted(() => ({
  authSpy: vi.fn(),
  verifyTokenSpy: vi.fn(),
  verifyRecoverySpy: vi.fn(),
  disableSpy: vi.fn(),
  findUniqueSpy: vi.fn(),
  rateLimitSpy: vi.fn(),
  writeAuditSpy: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => authSpy(),
}));

vi.mock("@/lib/mfa", () => ({
  verifyMFAToken: (...args: unknown[]) => verifyTokenSpy(...args),
  verifyRecoveryCode: (...args: unknown[]) => verifyRecoverySpy(...args),
  disableMFA: (...args: unknown[]) => disableSpy(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitSpy(...args),
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: (...args: unknown[]) => writeAuditSpy(...args),
  AUDIT_ACTIONS: {
    AUTH_MFA_DISABLED: "auth.mfa_disabled",
    AUTH_MFA_CHALLENGE_FAILURE: "auth.mfa_challenge_failure",
  },
}));

import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/auth/mfa/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const ADVISOR = {
  user: { id: "advisor-1", role: "ADVISOR", email: "a@test.com" },
};

beforeEach(() => {
  authSpy.mockReset();
  verifyTokenSpy.mockReset();
  verifyRecoverySpy.mockReset();
  disableSpy.mockReset();
  findUniqueSpy.mockReset();
  rateLimitSpy.mockReset();
  writeAuditSpy.mockReset();
  // Defaults for the happy path.
  rateLimitSpy.mockReturnValue({ success: true });
  findUniqueSpy.mockResolvedValue({ mfaEnabled: true });
  disableSpy.mockResolvedValue(undefined);
  writeAuditSpy.mockResolvedValue(undefined);
});

describe("POST /api/auth/mfa/disable", () => {
  it("returns 401 when unauthenticated", async () => {
    authSpy.mockResolvedValue(null);

    const res = await POST(makeReq({ token: "123456" }));

    expect(res.status).toBe(401);
    expect(disableSpy).not.toHaveBeenCalled();
  });

  it("returns 403 for client (USER) accounts", async () => {
    authSpy.mockResolvedValue({ user: { id: "u", role: "USER" } });

    const res = await POST(makeReq({ token: "123456" }));

    expect(res.status).toBe(403);
    expect(disableSpy).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    authSpy.mockResolvedValue(ADVISOR);
    rateLimitSpy.mockReturnValue({ success: false, resetAt: 123 });

    const res = await POST(makeReq({ token: "123456" }));

    expect(res.status).toBe(429);
    expect(disableSpy).not.toHaveBeenCalled();
  });

  it("returns 409 when MFA is not enabled", async () => {
    authSpy.mockResolvedValue(ADVISOR);
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });

    const res = await POST(makeReq({ token: "123456" }));

    expect(res.status).toBe(409);
    expect(disableSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when neither token nor recovery code is supplied", async () => {
    authSpy.mockResolvedValue(ADVISOR);

    const res = await POST(makeReq({}));

    expect(res.status).toBe(400);
    expect(verifyTokenSpy).not.toHaveBeenCalled();
    expect(disableSpy).not.toHaveBeenCalled();
  });

  it("does not disable MFA when the TOTP code is invalid", async () => {
    authSpy.mockResolvedValue(ADVISOR);
    verifyTokenSpy.mockResolvedValue(false);

    const res = await POST(makeReq({ token: "000000" }));

    expect(res.status).toBe(400);
    expect(disableSpy).not.toHaveBeenCalled();
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.mfa_challenge_failure" })
    );
  });

  it("disables MFA after a valid TOTP code and audits the change", async () => {
    authSpy.mockResolvedValue(ADVISOR);
    verifyTokenSpy.mockResolvedValue(true);

    const res = await POST(makeReq({ token: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(verifyTokenSpy).toHaveBeenCalledWith("advisor-1", "123456");
    expect(disableSpy).toHaveBeenCalledWith("advisor-1");
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.mfa_disabled" })
    );
  });

  it("disables MFA after a valid recovery code", async () => {
    authSpy.mockResolvedValue(ADVISOR);
    verifyRecoverySpy.mockResolvedValue(true);

    const res = await POST(makeReq({ recoveryCode: "abcd1234" }));

    expect(res.status).toBe(200);
    expect(verifyRecoverySpy).toHaveBeenCalledWith("advisor-1", "abcd1234");
    expect(verifyTokenSpy).not.toHaveBeenCalled();
    expect(disableSpy).toHaveBeenCalledWith("advisor-1");
  });
});
