import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const serviceSpies = vi.hoisted(() => ({
  createAdvisorInvitation: vi.fn(),
}));

vi.mock("@/lib/invitations/service", () => ({
  createAdvisorInvitation: serviceSpies.createAdvisorInvitation,
}));

vi.mock("@/lib/auth/user-email", () => ({
  findUserByEmail: vi.fn(async () => ({ id: "user-1", role: "ADVISOR" })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorProfile: {
      findUnique: vi.fn(async () => ({ id: "profile-1" })),
    },
  },
}));

vi.mock("@/lib/subscription/validation", () => ({
  getSubscriptionFeatures: vi.fn(async () => ({
    customSubdomainEnabled: false,
    advancedBrandingEnabled: true,
  })),
  ESSENTIALS_SUBSCRIPTION_FEATURES: {},
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(),
  AUDIT_ACTIONS: { INVITE_SEND: "invite.send" },
}));

import { POST } from "./route";

describe("POST /api/test/invitation/issue", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENABLE_TEST_AUTH", "1");
    serviceSpies.createAdvisorInvitation.mockResolvedValue({
      id: "inv-1",
      url: "https://app.test/signup?invite=tok&callbackUrl=%2Fintake",
      status: "SENT",
      intakeWaived: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when test auth is disabled", async () => {
    vi.stubEnv("ENABLE_TEST_AUTH", "0");
    const req = new NextRequest("http://localhost/api/test/invitation/issue", {
      method: "POST",
      body: JSON.stringify({ clientEmail: "c@test.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 on Vercel production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ENABLE_TEST_AUTH", "1");
    const req = new NextRequest("http://localhost/api/test/invitation/issue", {
      method: "POST",
      body: JSON.stringify({ clientEmail: "c@test.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates an invitation on Vercel preview when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ENABLE_TEST_AUTH", "1");
    const req = new NextRequest("http://localhost/api/test/invitation/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientEmail: "c@test.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(serviceSpies.createAdvisorInvitation).toHaveBeenCalledOnce();
  });

  it("creates an invitation and returns the signup URL", async () => {
    const req = new NextRequest("http://localhost/api/test/invitation/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientEmail: "Client@Example.com",
        intakeWaived: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitationId).toBe("inv-1");
    expect(body.url).toContain("signup");
    expect(serviceSpies.createAdvisorInvitation).toHaveBeenCalledWith(
      "profile-1",
      expect.objectContaining({
        clientEmail: "client@example.com",
        intakeWaived: true,
      }),
      expect.any(Object)
    );
  });
});
