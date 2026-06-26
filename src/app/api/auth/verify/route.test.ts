/**
 * Handler test for POST /api/auth/verify — focuses on the brute-force rate
 * limit (Critical). The magic-link consume + user projection are mocked; the
 * real in-memory rate limiter runs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { consumeCode, consumeLinkToken, projectUserByEmail, createMobileToken } = vi.hoisted(
  () => ({
    consumeCode: vi.fn(),
    consumeLinkToken: vi.fn(),
    projectUserByEmail: vi.fn(),
    createMobileToken: vi.fn(),
  }),
);

vi.mock("@/lib/mobile/magic-link", () => ({ consumeCode, consumeLinkToken }));
vi.mock("@/lib/mobile/token", () => ({ projectUserByEmail, createMobileToken }));

import { POST } from "./route";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/verify", () => {
  it("exchanges a valid code for a token + user", async () => {
    consumeCode.mockResolvedValue("valid@example.com");
    projectUserByEmail.mockResolvedValue({ id: "u1", email: "valid@example.com", role: "USER" });
    createMobileToken.mockReturnValue("bearer-token");

    // Unique email so this test's limiter bucket is independent.
    const res = await POST(postRequest({ email: "valid-ok@example.com", code: "123456" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ token: "bearer-token" });
  });

  it("returns 401 for a wrong code, then 429 once the attempt limit is hit", async () => {
    consumeCode.mockResolvedValue(null); // every guess is wrong
    const email = "brute-target@example.com";

    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest({ email, code: "000000" }));
      expect(res.status).toBe(401);
    }
    // 6th attempt within the window is throttled, even with a fresh guess.
    const blocked = await POST(postRequest({ email, code: "999999" }));
    expect(blocked.status).toBe(429);
    // The code is never even consulted once throttled.
    expect(consumeCode).toHaveBeenCalledTimes(5);
  });
});
