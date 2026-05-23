import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isTestAuthEnabled } from "./test-auth-enabled";

describe("isTestAuthEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("ENABLE_TEST_AUTH", "1");
  });

  it("returns false when ENABLE_TEST_AUTH is not 1", () => {
    vi.stubEnv("ENABLE_TEST_AUTH", "0");
    vi.stubEnv("NODE_ENV", "development");
    expect(isTestAuthEnabled()).toBe(false);
  });

  it("returns false on Vercel production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isTestAuthEnabled()).toBe(false);
  });

  it("returns true on Vercel preview even when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isTestAuthEnabled()).toBe(true);
  });

  it("returns true on Vercel development even when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "development");
    expect(isTestAuthEnabled()).toBe(true);
  });

  it("returns true in local dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isTestAuthEnabled()).toBe(true);
  });

  it("returns false for local production builds (next start)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isTestAuthEnabled()).toBe(false);
  });
});
