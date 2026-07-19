import { describe, expect, it } from "vitest";

import { ADVISOR_NAV_ITEMS, CLIENT_NAV_ITEMS } from "./ProtectedNav";

function visibleClientNavItems(options: {
  hideProfilesNav?: boolean;
  hideDocumentsNav?: boolean;
  hideIntakeNav?: boolean;
}) {
  return CLIENT_NAV_ITEMS.filter((item) => {
    if (options.hideProfilesNav && item.href === "/profiles") return false;
    if (options.hideDocumentsNav && item.href === "/documents") return false;
    if (options.hideIntakeNav && item.href === "/intake") return false;
    return true;
  });
}

describe("ProtectedNav route sets", () => {
  it("client nav includes Documents, Support, and Docs by default", () => {
    const hrefs = CLIENT_NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toContain("/documents");
    expect(hrefs).toContain("/support");
    expect(hrefs).toContain("/docs");
  });

  it("advisor and admin top nav include Support and Docs", () => {
    expect(ADVISOR_NAV_ITEMS.map((item) => item.href)).toContain("/support");
    expect(ADVISOR_NAV_ITEMS.map((item) => item.href)).toContain("/docs");
  });

  it("advisor nav does not include client-only intake, assessment, documents, or profiles", () => {
    const clientHrefs = CLIENT_NAV_ITEMS.map((item) => item.href);
    const advisorHrefs = ADVISOR_NAV_ITEMS.map((item) => item.href);

    for (const href of ["/intake", "/assessment", "/documents", "/profiles"]) {
      expect(clientHrefs).toContain(href);
      expect(advisorHrefs).not.toContain(href);
    }
  });

  it("hides Intake from client nav when intake was waived", () => {
    const hrefs = visibleClientNavItems({ hideIntakeNav: true }).map(
      (item) => item.href,
    );
    expect(hrefs).not.toContain("/intake");
    expect(hrefs).toContain("/assessment");
  });
});
