import { describe, it, expect } from "vitest";

import {
  DEFAULT_PASSWORD_POLICY,
  TEST_PASSWORD,
  buildPasswordRequirementsMessage,
  passwordMeetsPolicyRevision,
  userNeedsPasswordChange,
  validatePasswordComplexity,
} from "./password-policy";

describe("validatePasswordComplexity", () => {
  it("accepts passwords with 8+ chars, uppercase, and number", () => {
    expect(validatePasswordComplexity("Testpass1")).toEqual({ ok: true });
    expect(validatePasswordComplexity(TEST_PASSWORD)).toEqual({ ok: true });
  });

  it("rejects passwords shorter than the minimum length", () => {
    const result = validatePasswordComplexity("Test1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("8");
    }
  });

  it("rejects passwords missing an uppercase letter", () => {
    const result = validatePasswordComplexity("testpass1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/uppercase/i);
    }
  });

  it("rejects passwords missing a number", () => {
    const result = validatePasswordComplexity("Testpass");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/number/i);
    }
  });

  it("rejects passwords missing a special character when required", () => {
    const result = validatePasswordComplexity("Testpass1", {
      ...DEFAULT_PASSWORD_POLICY,
      requireSpecialCharacter: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/special character/i);
    }
  });

  it("accepts passwords with a special character when required", () => {
    expect(
      validatePasswordComplexity("Testpass1!", {
        ...DEFAULT_PASSWORD_POLICY,
        requireSpecialCharacter: true,
      })
    ).toEqual({ ok: true });
  });

  it("does not require lowercase or special characters by default", () => {
    expect(validatePasswordComplexity("TESTPASS1")).toEqual({ ok: true });
  });
});

describe("userNeedsPasswordChange", () => {
  it("flags legacy testpassword123-style passwords at login", () => {
    expect(
      userNeedsPasswordChange({
        password: "testpassword123",
        passwordChangeRequired: false,
        passwordPolicyRevision: 1,
        policy: DEFAULT_PASSWORD_POLICY,
      })
    ).toBe(true);
  });

  it("flags accounts behind the active policy revision", () => {
    expect(
      userNeedsPasswordChange({
        password: TEST_PASSWORD,
        passwordChangeRequired: false,
        passwordPolicyRevision: 0,
        policy: { ...DEFAULT_PASSWORD_POLICY, revision: 2 },
      })
    ).toBe(true);
  });

  it("accepts compliant passwords on the current revision", () => {
    expect(
      userNeedsPasswordChange({
        password: TEST_PASSWORD,
        passwordChangeRequired: false,
        passwordPolicyRevision: DEFAULT_PASSWORD_POLICY.revision,
        policy: DEFAULT_PASSWORD_POLICY,
      })
    ).toBe(false);
  });
});

describe("buildPasswordRequirementsMessage", () => {
  it("describes the default platform policy", () => {
    expect(buildPasswordRequirementsMessage()).toMatch(/8 characters/);
    expect(buildPasswordRequirementsMessage()).toMatch(/uppercase/);
    expect(buildPasswordRequirementsMessage()).toMatch(/number/);
  });
});

describe("passwordMeetsPolicyRevision", () => {
  it("treats missing revision as non-compliant", () => {
    expect(passwordMeetsPolicyRevision(undefined, 1)).toBe(false);
  });
});
