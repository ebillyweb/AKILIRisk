import { describe, expect, it } from "vitest";

import {
  formatFacilitatedLauncherClientOption,
  mapPipelineClientToLauncherClient,
  resolveFacilitatedSessionClientDisplayName,
} from "./launcher-display";
import type { PipelineClient } from "@/lib/pipeline/types";

const pseudonymousPipelineClient = {
  id: "clclient123456789",
  name: "Jordan Smith",
  firstName: "Jordan",
  lastName: "Smith",
  email: "jordan@example.com",
  clientReferenceCode: "CL-8F3K-29QX",
  pseudonymousWorkspaceLabeling: true,
} as PipelineClient;

describe("mapPipelineClientToLauncherClient", () => {
  it("maps pseudonymous pipeline clients without exposing email", () => {
    expect(mapPipelineClientToLauncherClient(pseudonymousPipelineClient)).toEqual({
      id: "clclient123456789",
      name: "Client CL-8F3K-29QX",
      email: "",
      secondary: null,
      pseudonymous: true,
    });
  });

  it("retains email for non-pseudonymous clients", () => {
    const client = {
      ...pseudonymousPipelineClient,
      pseudonymousWorkspaceLabeling: false,
    } as PipelineClient;

    expect(mapPipelineClientToLauncherClient(client)).toMatchObject({
      name: "Jordan Smith",
      email: "jordan@example.com",
      pseudonymous: false,
    });
  });
});

describe("resolveFacilitatedSessionClientDisplayName", () => {
  it("prefers enriched clientDisplayName from the session", () => {
    const pipelineById = new Map<string, PipelineClient>();
    expect(
      resolveFacilitatedSessionClientDisplayName(
        { clientId: "cl-1", clientDisplayName: "Client CL-8F3K-29QX" },
        pipelineById,
      ),
    ).toBe("Client CL-8F3K-29QX");
  });

  it("falls back to pipeline labels when display name is empty", () => {
    const pipelineById = new Map([
      ["cl-1", pseudonymousPipelineClient],
    ]);
    expect(
      resolveFacilitatedSessionClientDisplayName(
        { clientId: "cl-1", clientDisplayName: "" },
        pipelineById,
      ),
    ).toBe("Client CL-8F3K-29QX");
  });
});

describe("formatFacilitatedLauncherClientOption", () => {
  it("omits email for pseudonymous clients", () => {
    expect(
      formatFacilitatedLauncherClientOption({
        id: "cl-1",
        name: "Client CL-8F3K-29QX",
        email: "",
        pseudonymous: true,
      }),
    ).toBe("Client CL-8F3K-29QX");
  });

  it("includes secondary label for identifiable clients", () => {
    expect(
      formatFacilitatedLauncherClientOption({
        id: "cl-1",
        name: "Jordan Smith",
        email: "jordan@example.com",
        secondary: "Jordan S.",
        pseudonymous: false,
      }),
    ).toBe("Jordan Smith · Jordan S.");
  });

  it("appends open session suffix", () => {
    expect(
      formatFacilitatedLauncherClientOption({
        id: "cl-1",
        name: "Client CL-8F3K-29QX",
        email: "",
        pseudonymous: true,
        openSession: { id: "sess-1", status: "INTAKE" },
      }),
    ).toBe("Client CL-8F3K-29QX — open session");
  });
});
