import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { validateMagicLinkToken, signIn } = vi.hoisted(() => ({
  validateMagicLinkToken: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("@/lib/auth/magic-link", () => ({ validateMagicLinkToken }));
vi.mock("@/lib/auth", () => ({ signIn }));

import { GET } from "./route";

beforeEach(() => {
  validateMagicLinkToken.mockReset();
  signIn.mockReset();
});

describe("GET /auth/magic-link/verify", () => {
  it("redirects to failed page when token is missing", async () => {
    const req = new NextRequest("http://localhost:3000/auth/magic-link/verify");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/auth/magic-link/failed?reason=not_found"
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("redirects to failed page when token validation fails", async () => {
    validateMagicLinkToken.mockResolvedValue({
      success: false,
      reason: "expired",
    });
    const req = new NextRequest(
      "http://localhost:3000/auth/magic-link/verify?token=abc"
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/auth/magic-link/failed?reason=expired"
    );
  });

  it("calls signIn and redirects to dashboard on valid token", async () => {
    validateMagicLinkToken.mockResolvedValue({
      success: true,
      tokenId: "mlt-1",
      email: "client@test.com",
      inviteCodeId: null,
    });
    signIn.mockRejectedValue(
      Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" })
    );

    const req = new NextRequest(
      "http://localhost:3000/auth/magic-link/verify?token=valid"
    );

    await expect(GET(req)).rejects.toThrow("NEXT_REDIRECT");
    expect(signIn).toHaveBeenCalledWith("magic-link", {
      token: "valid",
      redirectTo: "/dashboard",
    });
  });
});
