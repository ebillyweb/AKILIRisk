import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveFromEmail } from "./resolve-from-email";

const envBackup = { ...process.env };

beforeEach(() => {
  process.env = { ...envBackup };
});

afterEach(() => {
  process.env = { ...envBackup };
});

describe("resolveFromEmail", () => {
  it("returns FROM_EMAIL when set", () => {
    process.env.FROM_EMAIL = "noreply@example.com";
    expect(resolveFromEmail()).toBe("noreply@example.com");
  });

  it("throws when RESEND_API_KEY is set but FROM_EMAIL is missing", () => {
    delete process.env.FROM_EMAIL;
    process.env.RESEND_API_KEY = "re_test";
    expect(() => resolveFromEmail()).toThrow(/FROM_EMAIL is required/);
  });

  it("falls back to Resend sandbox when mail is not configured", () => {
    delete process.env.FROM_EMAIL;
    delete process.env.RESEND_API_KEY;
    expect(resolveFromEmail()).toBe("onboarding@resend.dev");
  });
});
