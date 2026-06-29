import { describe, expect, it } from "vitest";
import {
  extractTenantPathPrefix,
  scopePathToCurrentTenant,
  scopePathToTenantPrefix,
} from "./tenant-path-prefix-client";

describe("extractTenantPathPrefix", () => {
  it("extracts the /t/{slug} prefix from portal paths", () => {
    expect(extractTenantPathPrefix("/t/ebilly/signin")).toBe("/t/ebilly");
    expect(extractTenantPathPrefix("/t/ebilly")).toBe("/t/ebilly");
    expect(extractTenantPathPrefix("/t/independent-wealth/advisor")).toBe(
      "/t/independent-wealth"
    );
  });

  it("returns null off-portal", () => {
    expect(extractTenantPathPrefix("/signin")).toBeNull();
    expect(extractTenantPathPrefix("/")).toBeNull();
    expect(extractTenantPathPrefix("/tenant/x")).toBeNull();
    expect(extractTenantPathPrefix("/things/t/x")).toBeNull();
  });
});

describe("scopePathToTenantPrefix", () => {
  it("prefixes app paths when a tenant prefix is present", () => {
    expect(scopePathToTenantPrefix("/dashboard", "/t/ebilly")).toBe(
      "/t/ebilly/dashboard"
    );
    expect(scopePathToTenantPrefix("/", "/t/ebilly")).toBe("/t/ebilly");
    expect(
      scopePathToTenantPrefix("/signin?callbackUrl=/advisor", "/t/ebilly")
    ).toBe("/t/ebilly/signin?callbackUrl=/advisor");
  });

  it("is a no-op without a prefix", () => {
    expect(scopePathToTenantPrefix("/dashboard", null)).toBe("/dashboard");
  });

  it("does not double-scope an already-prefixed path", () => {
    expect(scopePathToTenantPrefix("/t/ebilly/dashboard", "/t/ebilly")).toBe(
      "/t/ebilly/dashboard"
    );
    expect(scopePathToTenantPrefix("/t/ebilly", "/t/ebilly")).toBe("/t/ebilly");
  });
});

describe("scopePathToCurrentTenant", () => {
  it("re-applies the prefix from the current pathname", () => {
    expect(scopePathToCurrentTenant("/advisor", "/t/ebilly/signin")).toBe(
      "/t/ebilly/advisor"
    );
  });

  it("leaves the destination unchanged off-portal", () => {
    expect(scopePathToCurrentTenant("/advisor", "/signin")).toBe("/advisor");
  });
});
