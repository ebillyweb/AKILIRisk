import { describe, expect, it } from "vitest";

import {
  SUBDOMAIN_SLUG_REGEX,
  sanitizeSubdomainSlugInput,
} from "@/lib/advisor/subdomain-slug-input";

describe("sanitizeSubdomainSlugInput", () => {
  it("removes spaces and non-domain characters", () => {
    expect(sanitizeSubdomainSlugInput("My Firm!")).toBe("myfirm");
    expect(sanitizeSubdomainSlugInput("hello world")).toBe("helloworld");
    expect(sanitizeSubdomainSlugInput("foo@bar#baz")).toBe("foobarbaz");
  });

  it("lowercases and keeps internal hyphens", () => {
    expect(sanitizeSubdomainSlugInput("Acme-Wealth")).toBe("acme-wealth");
  });

  it("strips leading and trailing hyphens while typing", () => {
    expect(sanitizeSubdomainSlugInput("-acme-")).toBe("acme");
    expect(sanitizeSubdomainSlugInput("--test--")).toBe("test");
  });

  it("collapses repeated hyphens", () => {
    expect(sanitizeSubdomainSlugInput("acme--wealth")).toBe("acme-wealth");
  });

  it("enforces max length", () => {
    expect(sanitizeSubdomainSlugInput("abcdefghijklmnopqrstuvwxyz")).toHaveLength(20);
  });
});

describe("SUBDOMAIN_SLUG_REGEX", () => {
  it("accepts valid slugs", () => {
    expect(SUBDOMAIN_SLUG_REGEX.test("acme")).toBe(true);
    expect(SUBDOMAIN_SLUG_REGEX.test("acme-wealth")).toBe(true);
    expect(SUBDOMAIN_SLUG_REGEX.test("a1b2")).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(SUBDOMAIN_SLUG_REGEX.test("-acme")).toBe(false);
    expect(SUBDOMAIN_SLUG_REGEX.test("acme-")).toBe(false);
    expect(SUBDOMAIN_SLUG_REGEX.test("acme wealth")).toBe(false);
    expect(SUBDOMAIN_SLUG_REGEX.test("acme_wealth")).toBe(false);
  });
});
