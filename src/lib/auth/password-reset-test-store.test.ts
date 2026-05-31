import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearTestPasswordResetTokens,
  peekTestPasswordResetToken,
  recordTestPasswordResetToken,
} from "./password-reset-test-store";

describe("password-reset-test-store", () => {
  beforeEach(() => {
    clearTestPasswordResetTokens();
    vi.stubEnv("ENABLE_TEST_AUTH", "1");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearTestPasswordResetTokens();
  });

  it("records and returns the latest token for an email", () => {
    recordTestPasswordResetToken("advisor@test.com", {
      rawToken: "token-one",
      resetUrl: "https://example/reset?token=token-one",
      expires: new Date(Date.now() + 60_000),
    });

    const stored = peekTestPasswordResetToken("advisor@test.com");
    expect(stored?.rawToken).toBe("token-one");
  });

  it("normalizes email casing", () => {
    recordTestPasswordResetToken("Advisor@Test.com", {
      rawToken: "token-one",
      resetUrl: "https://example/reset?token=token-one",
      expires: new Date(Date.now() + 60_000),
    });

    expect(peekTestPasswordResetToken("advisor@test.com")?.rawToken).toBe(
      "token-one"
    );
  });

  it("overwrites prior tokens for the same email", () => {
    recordTestPasswordResetToken("advisor@test.com", {
      rawToken: "token-one",
      resetUrl: "https://example/reset?token=token-one",
      expires: new Date(Date.now() + 60_000),
    });
    recordTestPasswordResetToken("advisor@test.com", {
      rawToken: "token-two",
      resetUrl: "https://example/reset?token=token-two",
      expires: new Date(Date.now() + 60_000),
    });

    expect(peekTestPasswordResetToken("advisor@test.com")?.rawToken).toBe(
      "token-two"
    );
  });

  it("returns null for expired tokens", () => {
    recordTestPasswordResetToken("advisor@test.com", {
      rawToken: "token-one",
      resetUrl: "https://example/reset?token=token-one",
      expires: new Date(Date.now() - 1_000),
    });

    expect(peekTestPasswordResetToken("advisor@test.com")).toBeNull();
  });

  it("does not record when test auth is disabled", () => {
    vi.stubEnv("ENABLE_TEST_AUTH", "0");

    recordTestPasswordResetToken("advisor@test.com", {
      rawToken: "token-one",
      resetUrl: "https://example/reset?token=token-one",
      expires: new Date(Date.now() + 60_000),
    });

    expect(peekTestPasswordResetToken("advisor@test.com")).toBeNull();
  });
});
