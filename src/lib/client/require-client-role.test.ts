import { describe, expect, it } from "vitest";

import {
  isClientUserRole,
  redirectPathUnlessClientRole,
} from "./require-client-role";

describe("isClientUserRole", () => {
  it("is true only for USER", () => {
    expect(isClientUserRole("USER")).toBe(true);
    expect(isClientUserRole("user")).toBe(true);
  });

  it("is false for advisor and platform staff", () => {
    expect(isClientUserRole("ADVISOR")).toBe(false);
    expect(isClientUserRole("ADMIN")).toBe(false);
    expect(isClientUserRole("SUPER_ADMIN")).toBe(false);
  });
});

describe("redirectPathUnlessClientRole", () => {
  it("returns null for clients", () => {
    expect(redirectPathUnlessClientRole("USER")).toBeNull();
  });

  it("sends advisors and admins to their workspaces", () => {
    expect(redirectPathUnlessClientRole("ADVISOR")).toBe("/advisor");
    expect(redirectPathUnlessClientRole("ADMIN")).toBe("/admin");
    expect(redirectPathUnlessClientRole("SUPER_ADMIN")).toBe("/admin");
  });
});
