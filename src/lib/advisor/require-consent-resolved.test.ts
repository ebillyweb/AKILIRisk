import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbState } = vi.hoisted(() => ({
  dbState: {
    pending: false,
    pathname: "/dashboard",
    tenantPrefix: null as string | null,
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      if (key === "x-akili-pathname") return dbState.pathname;
      if (key === "x-tenant-path-prefix") return dbState.tenantPrefix;
      return null;
    },
  })),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/advisor/pending-consent", () => ({
  hasPendingConsent: vi.fn(async () => dbState.pending),
}));

import {
  consentPendingHref,
  isConsentPendingExemptPath,
  redirectIfPendingConsent,
  resolveConsentReturnPath,
} from "./require-consent-resolved";

beforeEach(() => {
  dbState.pending = false;
  dbState.pathname = "/dashboard";
  dbState.tenantPrefix = null;
  redirectMock.mockClear();
});

describe("isConsentPendingExemptPath", () => {
  it("allows /consent/pending and nested consent routes", () => {
    expect(isConsentPendingExemptPath("/consent/pending")).toBe(true);
    expect(isConsentPendingExemptPath("/consent/other")).toBe(true);
    expect(isConsentPendingExemptPath("/t/belvedere/consent/pending")).toBe(
      true,
    );
  });

  it("blocks workspace routes that need a resolved consent map", () => {
    expect(isConsentPendingExemptPath("/dashboard")).toBe(false);
    expect(isConsentPendingExemptPath("/settings")).toBe(false);
  });
});

describe("consentPendingHref", () => {
  it("preserves a client workspace return path", () => {
    expect(consentPendingHref("/assessment")).toBe(
      "/consent/pending?redirectTo=%2Fassessment",
    );
  });

  it("scopes consent and return paths under a tenant prefix", () => {
    expect(consentPendingHref("/assessment", "/t/belvedere")).toBe(
      "/t/belvedere/consent/pending?redirectTo=%2Ft%2Fbelvedere%2Fassessment",
    );
  });

  it("drops consent routes and unsafe paths", () => {
    expect(consentPendingHref("/consent/pending")).toBe("/consent/pending");
    expect(consentPendingHref("/advisor")).toBe("/consent/pending");
  });
});

describe("resolveConsentReturnPath", () => {
  it("defaults to dashboard", () => {
    expect(resolveConsentReturnPath(undefined)).toBe("/dashboard");
  });

  it("honors assessment deep links", () => {
    expect(resolveConsentReturnPath("/assessment")).toBe("/assessment");
  });
});

describe("redirectIfPendingConsent", () => {
  it("redirects to /consent/pending when assignments need consent", async () => {
    dbState.pending = true;
    await expect(redirectIfPendingConsent("c-1")).rejects.toThrow(
      "REDIRECT:/consent/pending"
    );
  });

  it("preserves the requested path in the consent redirect", async () => {
    dbState.pending = true;
    dbState.pathname = "/assessment";
    dbState.tenantPrefix = "/t/belvedere";
    await expect(redirectIfPendingConsent("c-1")).rejects.toThrow(
      "REDIRECT:/t/belvedere/consent/pending?redirectTo=%2Ft%2Fbelvedere%2Fassessment",
    );
  });

  it("does not redirect on the tenant consent page itself", async () => {
    dbState.pending = true;
    dbState.pathname = "/consent/pending";
    dbState.tenantPrefix = "/t/belvedere";
    await expect(redirectIfPendingConsent("c-1")).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not redirect when consent is already recorded", async () => {
    dbState.pending = false;
    await expect(redirectIfPendingConsent("c-1")).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
