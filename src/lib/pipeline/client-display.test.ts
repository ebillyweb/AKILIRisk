import { describe, expect, it } from "vitest";

import {
  formatPipelineClientRowTitle,
  formatPipelineClientSecondaryLabel,
  formatPipelineClientShortId,
  resolveAdvisorClientPipelineLabels,
  clientHasDistinctLegalName,
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

  it("shows a client reference when only email identity is available", () => {
    expect(
      formatPipelineClientSecondaryLabel({
        id: "clclient123456789",
        name: "client@example.com",
        firstName: null,
        lastName: null,
        email: "client@example.com",
        clientReferenceCode: "CL-8F3K-29QX",
      }),
    ).toBe("Client CL-8F3K-29QX");
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

  it("omits email from the hover title when pseudonymous labeling is on", () => {
    expect(
      formatPipelineClientRowTitle({
        id: "clclient123456789",
        name: "client@example.com",
        email: "client@example.com",
        clientReferenceCode: "CL-8F3K-29QX",
        pseudonymousWorkspaceLabeling: true,
      }),
    ).toBe("Client CL-8F3K-29QX");
  });
});

describe("resolveAdvisorClientPipelineLabels", () => {
  const emailOnlyClient = {
    id: "clclient123456789",
    name: "client@example.com",
    firstName: null,
    lastName: null,
    email: "client@example.com",
  } as const;

  it("shows email as the headline when client name collection is enabled", () => {
    expect(
      resolveAdvisorClientPipelineLabels({
        ...emailOnlyClient,
        clientReferenceCode: "CL-8F3K-29QX",
        pseudonymousWorkspaceLabeling: false,
      }),
    ).toEqual({
      headline: "client@example.com",
      secondary: "Client CL-8F3K-29QX",
      metaEmail: null,
      pseudonymous: false,
    });
  });

  it("shows a client reference when pseudonymous labeling is on", () => {
    expect(
      resolveAdvisorClientPipelineLabels({
        ...emailOnlyClient,
        clientReferenceCode: "CL-8F3K-29QX",
        pseudonymousWorkspaceLabeling: true,
      }),
    ).toEqual({
      headline: "Client CL-8F3K-29QX",
      secondary: null,
      metaEmail: null,
      pseudonymous: true,
    });
  });

  it("shows a client reference for every client when pseudonymous labeling is on", () => {
    expect(
      resolveAdvisorClientPipelineLabels({
        id: "clclient123456789",
        name: "Jordan Smith",
        firstName: "Jordan",
        lastName: "Smith",
        email: "jordan@example.com",
        clientReferenceCode: "CL-8F3K-29QX",
        pseudonymousWorkspaceLabeling: true,
      }),
    ).toEqual({
      headline: "Client CL-8F3K-29QX",
      secondary: null,
      metaEmail: null,
      pseudonymous: true,
    });
  });

  it("omits email from hover title for named clients when pseudonymous labeling is on", () => {
    expect(
      formatPipelineClientRowTitle({
        id: "clclient123456789",
        name: "Jordan Smith",
        firstName: "Jordan",
        lastName: "Smith",
        email: "jordan@example.com",
        clientReferenceCode: "CL-8F3K-29QX",
        pseudonymousWorkspaceLabeling: true,
      }),
    ).toBe("Client CL-8F3K-29QX");
  });
});

describe("formatPipelineClientShortId", () => {
  it("formats the client reference code", () => {
    expect(
      formatPipelineClientShortId({
        clientReferenceCode: "CL-8F3K-29QX",
      }),
    ).toBe("Client CL-8F3K-29QX");
  });

  it("requires a client reference code", () => {
    expect(() =>
      formatPipelineClientShortId({
        clientReferenceCode: null,
      }),
    ).toThrow("clientReferenceCode is required for pseudonymous display");
  });
});

describe("clientHasDistinctLegalName", () => {
  it("treats email-shaped names as not distinct", () => {
    expect(clientHasDistinctLegalName("client@example.com", "client@example.com")).toBe(
      false,
    );
  });
});
