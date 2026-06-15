import { describe, expect, it } from "vitest";

import {
  formatPipelineClientRowTitle,
  formatPipelineClientSecondaryLabel,
} from "./client-display";

describe("formatPipelineClientSecondaryLabel", () => {
  it("prefers first name and last initial from structured fields", () => {
    expect(
      formatPipelineClientSecondaryLabel({
        id: "clclient123456789",
        name: "Jordan Smith",
        firstName: "Jordan",
        lastName: "Smith",
        email: "jordan@example.com",
      }),
    ).toBe("Jordan S.");
  });

  it("falls back to parsing the display name when parts are missing", () => {
    expect(
      formatPipelineClientSecondaryLabel({
        id: "clclient123456789",
        name: "Taylor Morgan",
        firstName: null,
        lastName: null,
        email: "taylor@example.com",
      }),
    ).toBe("Taylor M.");
  });

  it("shows a short client id when only email identity is available", () => {
    expect(
      formatPipelineClientSecondaryLabel({
        id: "clclient123456789",
        name: "client@example.com",
        firstName: null,
        lastName: null,
        email: "client@example.com",
      }),
    ).toBe("ID 23456789");
  });
});

describe("formatPipelineClientRowTitle", () => {
  it("includes email in the hover title", () => {
    expect(
      formatPipelineClientRowTitle({
        id: "clclient123456789",
        name: "Jordan Smith",
        firstName: "Jordan",
        lastName: "Smith",
        email: "jordan@example.com",
      }),
    ).toBe("Jordan Smith · Jordan S. · jordan@example.com");
  });
});
