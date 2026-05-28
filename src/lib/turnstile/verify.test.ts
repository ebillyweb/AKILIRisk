import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isContactCaptchaBypassEnabled,
  verifyTurnstileToken,
} from "./verify";

describe("verifyTurnstileToken", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalSkip = process.env.CONTACT_FORM_SKIP_CAPTCHA;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret;
    process.env.CONTACT_FORM_SKIP_CAPTCHA = originalSkip;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns true when Cloudflare reports success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const ok = await verifyTurnstileToken("token-123", "203.0.113.1");
    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns false when token is empty", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const ok = await verifyTurnstileToken("", null);
    expect(ok).toBe(false);
  });

  it("uses bypass in non-production when configured and secret missing", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.CONTACT_FORM_SKIP_CAPTCHA = "1";
    vi.stubEnv("NODE_ENV", "development");

    const ok = await verifyTurnstileToken("any", null);
    expect(ok).toBe(isContactCaptchaBypassEnabled());
    expect(fetch).not.toHaveBeenCalled();
  });
});
