import { describe, it, expect } from "vitest";

import {
  isApiMfaExempt,
  isMfaChallengePending,
  isMfaSetupPending,
  isPageMfaExempt,
  isWorkspacePath,
  shouldBlockApiForMfaPending,
  shouldBlockApiForMfaSetupPending,
} from "./mfa-gate";

describe("isMfaChallengePending", () => {
  it("returns false when MFA is disabled", () => {
    expect(isMfaChallengePending({ mfaEnabled: false, mfaVerified: false })).toBe(
      false
    );
  });

  it("returns false when MFA is enabled and verified", () => {
    expect(isMfaChallengePending({ mfaEnabled: true, mfaVerified: true })).toBe(
      false
    );
  });

  it("returns true when MFA is enabled but not verified", () => {
    expect(isMfaChallengePending({ mfaEnabled: true, mfaVerified: false })).toBe(
      true
    );
  });
});

describe("isWorkspacePath", () => {
  it("includes consent, profiles, documents, and family routes", () => {
    expect(isWorkspacePath("/consent/pending")).toBe(true);
    expect(isWorkspacePath("/profiles")).toBe(true);
    expect(isWorkspacePath("/documents")).toBe(true);
    expect(isWorkspacePath("/family/dashboard")).toBe(true);
  });

  it("excludes marketing auth pages", () => {
    expect(isWorkspacePath("/signin")).toBe(false);
    expect(isWorkspacePath("/about")).toBe(false);
  });
});

describe("isPageMfaExempt", () => {
  it("allows MFA verify and setup during the challenge", () => {
    expect(isPageMfaExempt("/mfa/verify")).toBe(true);
    expect(isPageMfaExempt("/mfa/setup")).toBe(true);
  });
});

describe("isMfaSetupPending", () => {
  it("never requires enrollment (MFA is opt-in only)", () => {
    expect(
      isMfaSetupPending({
        mfaEnrollmentRequired: true,
        mfaEnabled: false,
      })
    ).toBe(false);
  });
});

describe("API MFA setup exemptions", () => {
  it("allows MFA enroll routes during setup pending", () => {
    expect(shouldBlockApiForMfaSetupPending("/api/auth/mfa/enroll")).toBe(false);
    expect(shouldBlockApiForMfaSetupPending("/api/auth/mfa/verify")).toBe(false);
  });

  it("blocks workspace APIs until MFA is enrolled", () => {
    expect(shouldBlockApiForMfaSetupPending("/api/advisor/branding")).toBe(true);
    expect(shouldBlockApiForMfaSetupPending("/api/auth/signout")).toBe(false);
  });
});

describe("API MFA exemptions", () => {
  it("allows auth and webhook routes during MFA pending", () => {
    expect(isApiMfaExempt("/api/auth/mfa/verify")).toBe(true);
    expect(isApiMfaExempt("/api/auth/mfa/recovery")).toBe(true);
    expect(isApiMfaExempt("/api/webhooks/stripe")).toBe(true);
    expect(isApiMfaExempt("/api/cron/workflow-reminders")).toBe(true);
    expect(isApiMfaExempt("/api/invite/prefill")).toBe(true);
  });

  it("blocks workspace APIs until MFA is verified", () => {
    expect(shouldBlockApiForMfaPending("/api/assessment/abc/score")).toBe(true);
    expect(shouldBlockApiForMfaPending("/api/advisor/branding")).toBe(true);
    expect(shouldBlockApiForMfaPending("/api/auth/mfa/verify")).toBe(false);
  });
});
