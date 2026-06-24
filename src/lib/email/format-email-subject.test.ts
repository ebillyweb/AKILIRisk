import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatEmailSubject,
  isPreviewEmailEnvironment,
} from "./format-email-subject";

const envBackup = { ...process.env };

beforeEach(() => {
  process.env = { ...envBackup };
});

afterEach(() => {
  process.env = { ...envBackup };
});

describe("formatEmailSubject", () => {
  it("returns subject unchanged outside preview", () => {
    process.env.VERCEL_ENV = "production";
    expect(formatEmailSubject("Reset your Akili Risk password")).toBe(
      "Reset your Akili Risk password",
    );
  });

  it("prefixes subject on Vercel preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(formatEmailSubject("Reset your Akili Risk password")).toBe(
      "[PREVIEW] Reset your Akili Risk password",
    );
  });

  it("does not double-prefix preview subjects", () => {
    process.env.VERCEL_ENV = "preview";
    expect(formatEmailSubject("[PREVIEW] Already tagged")).toBe(
      "[PREVIEW] Already tagged",
    );
  });
});

describe("isPreviewEmailEnvironment", () => {
  it("is true only on preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isPreviewEmailEnvironment()).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(isPreviewEmailEnvironment()).toBe(false);
  });
});
