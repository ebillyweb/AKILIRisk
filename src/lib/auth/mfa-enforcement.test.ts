import { describe, it, expect } from "vitest";

import {
  isMfaEnrollmentPending,
  isMfaEnrollmentRequiredForUser,
  isStaffRoleRequiringMfa,
} from "./mfa-enforcement";

describe("isStaffRoleRequiringMfa", () => {
  it("requires MFA for advisor and admin roles", () => {
    expect(isStaffRoleRequiringMfa("ADVISOR")).toBe(true);
    expect(isStaffRoleRequiringMfa("ADMIN")).toBe(true);
    expect(isStaffRoleRequiringMfa("SUPER_ADMIN")).toBe(true);
  });

  it("does not require MFA for client users by default", () => {
    expect(isStaffRoleRequiringMfa("USER")).toBe(false);
  });
});

describe("isMfaEnrollmentRequiredForUser", () => {
  it("requires enrollment for staff without MFA enabled", () => {
    expect(
      isMfaEnrollmentRequiredForUser({
        role: "ADVISOR",
        mfaEnabled: false,
      })
    ).toBe(true);
  });

  it("does not require enrollment once MFA is enabled", () => {
    expect(
      isMfaEnrollmentRequiredForUser({
        role: "ADMIN",
        mfaEnabled: true,
      })
    ).toBe(false);
  });

  it("requires enrollment for clients when platform toggle is on", () => {
    expect(
      isMfaEnrollmentRequiredForUser({
        role: "USER",
        mfaEnabled: false,
        mfaRequiredForAllRoles: true,
      })
    ).toBe(true);
  });
});

describe("isMfaEnrollmentPending", () => {
  it("returns true when JWT marks enrollment required and MFA is off", () => {
    expect(
      isMfaEnrollmentPending({
        mfaEnrollmentRequired: true,
        mfaEnabled: false,
      })
    ).toBe(true);
  });

  it("returns false after MFA is enabled", () => {
    expect(
      isMfaEnrollmentPending({
        mfaEnrollmentRequired: true,
        mfaEnabled: true,
      })
    ).toBe(false);
  });
});
