import { describe, it, expect } from "vitest";

import {
  isPasswordChangePending,
  isPagePasswordChangeExempt,
  shouldBlockApiForPasswordChangePending,
} from "./password-change-gate";

describe("password change gate", () => {
  it("detects pending password updates from JWT claims", () => {
    expect(isPasswordChangePending({ passwordChangeRequired: true })).toBe(true);
    expect(isPasswordChangePending({ passwordChangeRequired: false })).toBe(false);
  });

  it("allows the change-password page during the gate", () => {
    expect(isPagePasswordChangeExempt("/change-password")).toBe(true);
    expect(isPagePasswordChangeExempt("/dashboard")).toBe(false);
  });

  it("blocks workspace APIs until the password is updated", () => {
    expect(shouldBlockApiForPasswordChangePending("/api/advisor/branding")).toBe(true);
    expect(shouldBlockApiForPasswordChangePending("/api/auth/change-password")).toBe(false);
  });
});
