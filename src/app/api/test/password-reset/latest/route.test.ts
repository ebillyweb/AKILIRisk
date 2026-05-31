import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the test-only password-reset token retrieval endpoint.
 */

const { peekSpy } = vi.hoisted(() => ({
  peekSpy: vi.fn(),
}));

vi.mock("@/lib/auth/password-reset-test-store", () => ({
  peekTestPasswordResetToken: (...args: unknown[]) => peekSpy(...args),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.unstubAllEnvs();
  peekSpy.mockReset();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ENABLE_TEST_AUTH", "1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/test/password-reset/latest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("/api/test/password-reset/latest — gating", () => {
  it("returns 404 on Vercel production even when ENABLE_TEST_AUTH=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ENABLE_TEST_AUTH", "1");

    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    expect(res.status).toBe(404);
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it("returns 200 on Vercel preview when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ENABLE_TEST_AUTH", "1");
    peekSpy.mockReturnValue({
      rawToken: "abc123def456",
      resetUrl:
        "https://preview.akilirisk.com/reset-password?token=abc123def456&email=advisor%40test.com",
      expires: new Date("2030-01-01T00:00:00Z"),
    });

    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    expect(res.status).toBe(200);
    expect(peekSpy).toHaveBeenCalledOnce();
  });

  it("returns 404 when ENABLE_TEST_AUTH !== '1'", async () => {
    vi.stubEnv("ENABLE_TEST_AUTH", "0");

    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    expect(res.status).toBe(404);
    expect(peekSpy).not.toHaveBeenCalled();
  });
});

describe("/api/test/password-reset/latest — happy path", () => {
  beforeEach(() => {
    peekSpy.mockReturnValue({
      rawToken: "abc123def456",
      resetUrl:
        "https://preview.akilirisk.com/reset-password?token=abc123def456&email=advisor%40test.com",
      expires: new Date("2030-01-01T00:00:00Z"),
    });
  });

  it("returns 200 + rawToken + resetUrl + expires", async () => {
    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rawToken).toBe("abc123def456");
    expect(body.resetUrl).toBe(
      "https://preview.akilirisk.com/reset-password?token=abc123def456&email=advisor%40test.com"
    );
    expect(body.expires).toBe("2030-01-01T00:00:00.000Z");
  });

  it("normalizes email casing before lookup", async () => {
    await POST(makeRequest({ email: "Advisor@Test.com" }));
    expect(peekSpy).toHaveBeenCalledWith("advisor@test.com");
  });

  it("returns 404 when no token is stored", async () => {
    peekSpy.mockReturnValue(null);
    const res = await POST(makeRequest({ email: "advisor@test.com" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no active password reset token/i);
  });
});

describe("/api/test/password-reset/latest — input validation", () => {
  it("returns 400 for a malformed email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request(
      "http://localhost:3000/api/test/password-reset/latest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      }
    ) as never;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
