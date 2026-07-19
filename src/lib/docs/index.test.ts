import { describe, expect, it } from "vitest";
import {
  DOCS_NAV,
  DOCS_PAGES,
  buildDocsLlmsTxt,
  docsHref,
  getAdjacentDocsPages,
  getDocsArticleSlugs,
  getDocsPage,
  getHubFeaturedPages,
} from "@/lib/docs";

describe("docs registry", () => {
  it("registers a welcome hub and unique article slugs", () => {
    expect(getDocsPage("")?.title).toBe("Welcome");
    const slugs = getDocsArticleSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps nav items resolvable to pages", () => {
    for (const group of DOCS_NAV) {
      for (const item of group.items) {
        expect(getDocsPage(item.slug), `missing page for ${item.slug}`).toBeTruthy();
      }
    }
  });

  it("exposes hub featured guides and adjacency", () => {
    expect(getHubFeaturedPages().length).toBeGreaterThanOrEqual(3);
    const { previous, next } = getAdjacentDocsPages("intake");
    expect(previous?.slug).toBe("quickstart-firms");
    expect(next?.slug).toBe("assessment");
  });

  it("builds docs hrefs and llms.txt", () => {
    expect(docsHref("")).toBe("/docs");
    expect(docsHref("pipeline")).toBe("/docs/pipeline");
    const text = buildDocsLlmsTxt("https://example.com");
    expect(text).toContain("https://example.com/docs");
    expect(text).toContain(DOCS_PAGES[1]!.title);
  });
});
