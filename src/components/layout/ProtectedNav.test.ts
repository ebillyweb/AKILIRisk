import { describe, expect, it } from "vitest";

import { ADVISOR_NAV_ITEMS, CLIENT_NAV_ITEMS } from "./ProtectedNav";

describe("ProtectedNav route sets", () => {
  it("advisor nav does not include client-only intake, assessment, or profiles", () => {
    const clientHrefs = CLIENT_NAV_ITEMS.map((item) => item.href);
    const advisorHrefs = ADVISOR_NAV_ITEMS.map((item) => item.href);

    for (const href of ["/intake", "/assessment", "/profiles"]) {
      expect(clientHrefs).toContain(href);
      expect(advisorHrefs).not.toContain(href);
    }
  });
});
