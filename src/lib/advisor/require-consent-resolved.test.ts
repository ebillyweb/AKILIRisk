import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbState } = vi.hoisted(() => ({
  dbState: {
    pending: false,
    pathname: "/dashboard",
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) =>
      key === "x-akili-pathname" ? dbState.pathname : null,
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
  isConsentPendingExemptPath,
  redirectIfPendingConsent,
} from "./require-consent-resolved";

beforeEach(() => {
  dbState.pending = false;
  dbState.pathname = "/dashboard";
  redirectMock.mockClear();
});

describe("isConsentPendingExemptPath", () => {
  it("allows /consent/pending and nested consent routes", () => {
    expect(isConsentPendingExemptPath("/consent/pending")).toBe(true);
    expect(isConsentPendingExemptPath("/consent/other")).toBe(true);
  });

  it("blocks workspace routes that need a resolved consent map", () => {
    expect(isConsentPendingExemptPath("/dashboard")).toBe(false);
    expect(isConsentPendingExemptPath("/settings")).toBe(false);
  });
});

describe("redirectIfPendingConsent", () => {
  it("redirects to /consent/pending when assignments need consent", async () => {
    dbState.pending = true;
    await expect(redirectIfPendingConsent("c-1")).rejects.toThrow(
      "REDIRECT:/consent/pending"
    );
  });

  it("does not redirect on the consent page itself", async () => {
    dbState.pending = true;
    dbState.pathname = "/consent/pending";
    await expect(redirectIfPendingConsent("c-1")).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not redirect when consent is already recorded", async () => {
    dbState.pending = false;
    await expect(redirectIfPendingConsent("c-1")).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
