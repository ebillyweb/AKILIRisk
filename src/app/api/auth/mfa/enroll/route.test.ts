import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  authSpy,
  enrollSpy,
  findUniqueSpy,
} = vi.hoisted(() => ({
  authSpy: vi.fn(),
  enrollSpy: vi.fn(),
  findUniqueSpy: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => authSpy(),
}));

vi.mock("@/lib/mfa", () => ({
  enrollMFA: (...args: unknown[]) => enrollSpy(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
    },
  },
}));

import { POST } from "./route";

beforeEach(() => {
  authSpy.mockReset();
  enrollSpy.mockReset();
  findUniqueSpy.mockReset();
});

describe("POST /api/auth/mfa/enroll", () => {
  it("returns 401 when unauthenticated", async () => {
    authSpy.mockResolvedValue(null);

    const res = await POST(new Request("http://localhost/api/auth/mfa/enroll", {
      method: "POST",
    }) as never);

    expect(res.status).toBe(401);
    expect(enrollSpy).not.toHaveBeenCalled();
  });

  it("allows client (USER) role to enroll optionally", async () => {
    authSpy.mockResolvedValue({
      user: {
        id: "client-1",
        role: "USER",
        mfaEnabled: false,
        mfaEnrollmentRequired: false,
      },
    });
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });
    enrollSpy.mockResolvedValue({
      qrCodeUrl: "data:image/png;base64,xyz",
      secret: "SECRETKEY123",
    });

    const res = await POST(new Request("http://localhost/api/auth/mfa/enroll", {
      method: "POST",
    }) as never);

    expect(res.status).toBe(200);
    expect(enrollSpy).toHaveBeenCalled();
  });

  it("allows client enrollment when session marks enrollment required", async () => {
    authSpy.mockResolvedValue({
      user: {
        id: "client-1",
        role: "USER",
        mfaEnabled: false,
        mfaEnrollmentRequired: true,
      },
    });
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });
    enrollSpy.mockResolvedValue({
      qrCodeUrl: "data:image/png;base64,xyz",
      secret: "SECRETKEY123",
    });

    const res = await POST(new Request("http://localhost/api/auth/mfa/enroll", {
      method: "POST",
    }) as never);

    expect(res.status).toBe(200);
    expect(enrollSpy).toHaveBeenCalled();
  });

  it("returns 409 when MFA is already enabled", async () => {
    authSpy.mockResolvedValue({
      user: { id: "user-1", role: "ADVISOR", mfaEnabled: true },
    });
    findUniqueSpy.mockResolvedValue({ mfaEnabled: true });

    const res = await POST(new Request("http://localhost/api/auth/mfa/enroll", {
      method: "POST",
    }) as never);

    expect(res.status).toBe(409);
    expect(enrollSpy).not.toHaveBeenCalled();
  });

  it("returns QR code + secret without enabling MFA", async () => {
    authSpy.mockResolvedValue({
      user: { id: "advisor-1", role: "ADVISOR", mfaEnabled: false },
    });
    findUniqueSpy.mockResolvedValue({ mfaEnabled: false });
    enrollSpy.mockResolvedValue({
      qrCodeUrl: "data:image/png;base64,xyz",
      secret: "SECRETKEY123",
    });

    const res = await POST(new Request("http://localhost/api/auth/mfa/enroll", {
      method: "POST",
    }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.secret).toBe("SECRETKEY123");
    expect(body.qrCodeUrl).toBe("data:image/png;base64,xyz");
  });
});
