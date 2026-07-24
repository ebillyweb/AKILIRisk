import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveFromEmail,
  sanitizeFromEmailAvoidingNoReply,
} from "./resolve-from-email";

const envBackup = { ...process.env };

beforeEach(() => {
  process.env = { ...envBackup };
});

afterEach(() => {
  process.env = { ...envBackup };
});

describe("sanitizeFromEmailAvoidingNoReply", () => {
  it("rewrites plain noreply local parts to notifications@", () => {
    expect(
      sanitizeFromEmailAvoidingNoReply("akilirisk-noreply@mail.example.com")
    ).toBe("notifications@mail.example.com");
    expect(sanitizeFromEmailAvoidingNoReply("no-reply@example.com")).toBe(
      "notifications@example.com"
    );
    expect(sanitizeFromEmailAvoidingNoReply("noreply@example.com")).toBe(
      "notifications@example.com"
    );
  });

  it("rewrites display-name forms", () => {
    expect(
      sanitizeFromEmailAvoidingNoReply(
        "AKILI Risk <akilirisk-noreply@mail.example.com>"
      )
    ).toBe("AKILI Risk <notifications@mail.example.com>");
  });

  it("leaves monitored addresses unchanged", () => {
    expect(sanitizeFromEmailAvoidingNoReply("hello@mail.example.com")).toBe(
      "hello@mail.example.com"
    );
    expect(
      sanitizeFromEmailAvoidingNoReply("AKILI <notifications@mail.example.com>")
    ).toBe("AKILI <notifications@mail.example.com>");
  });
});

describe("resolveFromEmail", () => {
  it("returns sanitized FROM_EMAIL when set", () => {
    process.env.FROM_EMAIL = "akilirisk-noreply@mail.example.com";
    expect(resolveFromEmail()).toBe("notifications@mail.example.com");
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
