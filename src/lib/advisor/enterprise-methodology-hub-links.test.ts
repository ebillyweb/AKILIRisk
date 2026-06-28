import { describe, expect, it } from "vitest";

import {
  ENTERPRISE_METHODOLOGY_HUB_LINKS,
  ENTERPRISE_METHODOLOGY_QUESTION_PATH,
} from "./enterprise-methodology-hub-links";

describe("enterprise methodology hub links", () => {
  it("exposes the four firm methodology hub destinations", () => {
    const hrefs = ENTERPRISE_METHODOLOGY_HUB_LINKS.map((link) => link.href);
    expect(hrefs).toEqual([
      "/advisor/enterprise/methodology/pillars",
      "/advisor/enterprise/methodology/intake",
      "/advisor/enterprise/methodology/narratives/governance",
      "/advisor/enterprise/recommendations/governance",
    ]);
  });

  it("includes non-empty titles and descriptions for each hub card", () => {
    for (const link of ENTERPRISE_METHODOLOGY_HUB_LINKS) {
      expect(link.title.trim().length).toBeGreaterThan(0);
      expect(link.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds per-pillar assessment question paths", () => {
    expect(ENTERPRISE_METHODOLOGY_QUESTION_PATH("governance")).toBe(
      "/advisor/enterprise/methodology/questions/governance",
    );
  });
});
