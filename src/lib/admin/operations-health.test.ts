import { describe, expect, it } from "vitest";
import { resolveBuildFromEnv } from "@/lib/admin/operations-health";

describe("resolveBuildFromEnv", () => {
  it("prefers Vercel SHA/ref with build-injected commit date", () => {
    expect(
      resolveBuildFromEnv({
        VERCEL_GIT_COMMIT_SHA: "89984027039ff6231b4bad849cfb710683e0c265",
        VERCEL_GIT_COMMIT_REF: "staging",
        BUILD_GIT_COMMIT_DATE: "2026-05-19T03:00:00.000Z",
      })
    ).toEqual({
      shortSha: "8998402",
      ref: "staging",
      committedAt: "2026-05-19T03:00:00.000Z",
    });
  });

  it("falls back to BUILD_GIT_* for local dev", () => {
    expect(
      resolveBuildFromEnv({
        BUILD_GIT_COMMIT_SHA: "abcdef1234567890",
        BUILD_GIT_COMMIT_REF: "staging",
        BUILD_GIT_COMMIT_DATE: "2026-05-18T12:00:00-05:00",
      })
    ).toEqual({
      shortSha: "abcdef1",
      ref: "staging",
      committedAt: "2026-05-18T12:00:00-05:00",
    });
  });

  it("returns nulls when no git metadata is present", () => {
    expect(resolveBuildFromEnv({})).toEqual({
      shortSha: null,
      ref: null,
      committedAt: null,
    });
  });
});
