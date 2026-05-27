import { describe, expect, it } from "vitest";
import {
  parseHeroAudienceHash,
  parseHeroAudienceParam,
  resolveHeroAudience,
} from "@/components/home/hero/hero-audience-persistence";

describe("parseHeroAudienceParam", () => {
  it("accepts canonical and alias values", () => {
    expect(parseHeroAudienceParam("families")).toBe("families");
    expect(parseHeroAudienceParam("family")).toBe("families");
    expect(parseHeroAudienceParam("consumer")).toBe("families");
    expect(parseHeroAudienceParam("advisors")).toBe("advisors");
    expect(parseHeroAudienceParam("advisor")).toBe("advisors");
  });

  it("rejects unknown values", () => {
    expect(parseHeroAudienceParam("")).toBeNull();
    expect(parseHeroAudienceParam("invalid")).toBeNull();
  });
});

describe("parseHeroAudienceHash", () => {
  it("parses hash fragments", () => {
    expect(parseHeroAudienceHash("#advisors")).toBe("advisors");
    expect(parseHeroAudienceHash("families")).toBe("families");
  });
});

describe("resolveHeroAudience", () => {
  it("prefers query over hash and storage", () => {
    expect(
      resolveHeroAudience({
        search: "?audience=families",
        hash: "#advisors",
        storage: "advisors",
      })
    ).toBe("families");
  });

  it("uses hash when query is absent", () => {
    expect(
      resolveHeroAudience({
        search: "",
        hash: "#advisors",
        storage: "families",
      })
    ).toBe("advisors");
  });

  it("uses storage when query and hash are absent", () => {
    expect(
      resolveHeroAudience({
        search: "",
        hash: "",
        storage: "advisors",
      })
    ).toBe("advisors");
  });

  it("defaults to families", () => {
    expect(resolveHeroAudience({ search: "", hash: "", storage: null })).toBe(
      "families"
    );
  });
});
