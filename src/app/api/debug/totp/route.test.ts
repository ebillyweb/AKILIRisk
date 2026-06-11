import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";

describe("/api/debug/totp — production guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 for GET when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEBUG_TOTP", "1");

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 404 for POST when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEBUG_TOTP", "1");

    const req = new Request("http://localhost:3000/api/debug/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }) as never;

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 when ALLOW_DEBUG_TOTP is not set even in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEBUG_TOTP", "");

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("responds when both development and ALLOW_DEBUG_TOTP=1 are set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEBUG_TOTP", "1");

    const res = await GET();
    expect(res.status).toBe(200);
  });
});
