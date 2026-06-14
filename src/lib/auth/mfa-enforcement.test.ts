import { describe, it, expect } from "vitest";

import {
  isMfaEnrollmentPending,
  isMfaEnrollmentRequiredForUser,
  isStaffRoleRequiringMfa,
} from "./mfa-enforcement";

describe("isStaffRoleRequiringMfa", () => {
  it("does not require MFA for any role", () => {
    expect(isStaffRoleRequiringMfa("ADVISOR")).toBe(false);
    expect(isStaffRoleRequiringMfa("ADMIN")).toBe(false);
    expect(isStaffRoleRequiringMfa("SUPER_ADMIN")).toBe(false);
    expect(isStaffRoleRequiringMfa("USER")).toBe(false);
  });
});

describe("isMfaEnrollmentRequiredForUser", () => {
  it("never requires enrollment (MFA is optional for all roles)", () => {
    expect(
      isMfaEnrollmentRequiredForUser({
        role: "ADVISOR",
        mfaEnabled: false,
      })
    ).toBe(false);

    expect(
      isMfaEnrollmentRequiredForUser({
        role: "USER",
        mfaEnabled: false,
        mfaRequiredForAllRoles: true,
      })
    ).toBe(false);
  });
});

describe("isMfaEnrollmentPending", () => {
  it("never requires enrollment (MFA is opt-in only)", () => {
    expect(
      isMfaEnrollmentPending({
        mfaEnrollmentRequired: true,
        mfaEnabled: false,
      })
    ).toBe(false);

    expect(
      isMfaEnrollmentPending({
        mfaEnrollmentRequired: false,
        mfaEnabled: false,
      })
    ).toBe(false);
  });
});
