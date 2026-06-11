import { InvitationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildInvitationsListHref,
  parseInvitationListParams,
} from "./parse-invitation-list-params";

describe("parseInvitationListParams", () => {
  it("parses status, search, sentWithin, and page", () => {
    const parsed = parseInvitationListParams({
      status: InvitationStatus.REGISTERED,
      search: "client@test.com",
      sentWithin: "30",
      page: "2",
    });

    expect(parsed.filters.status).toBe(InvitationStatus.REGISTERED);
    expect(parsed.filters.search).toBe("client@test.com");
    expect(parsed.filters.sentWithinDays).toBe(30);
    expect(parsed.page).toBe(2);
    expect(parsed.hasActiveFilters).toBe(true);
  });

  it("defaults page to 1 and ignores invalid values", () => {
    const parsed = parseInvitationListParams({
      status: "INVALID",
      sentWithin: "14",
      page: "0",
    });

    expect(parsed.filters.status).toBeUndefined();
    expect(parsed.filters.sentWithinDays).toBeUndefined();
    expect(parsed.page).toBe(1);
    expect(parsed.hasActiveFilters).toBe(false);
  });
});

describe("buildInvitationsListHref", () => {
  it("preserves filters and page in the query string", () => {
    expect(
      buildInvitationsListHref(
        {
          status: InvitationStatus.EXPIRED,
          search: "buddy",
          sentWithinDays: 7,
        },
        3
      )
    ).toBe(
      "/advisor/invitations?status=EXPIRED&search=buddy&sentWithin=7&page=3"
    );
  });
});
