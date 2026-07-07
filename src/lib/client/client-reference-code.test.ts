import { describe, expect, it } from "vitest";

import {
  formatClientReferenceLabel,
  generateClientReferenceCode,
} from "@/lib/client/client-reference-code";

describe("generateClientReferenceCode", () => {
  it("matches the CL-XXXX-XXXX pattern", () => {
    expect(generateClientReferenceCode()).toMatch(/^CL-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

describe("formatClientReferenceLabel", () => {
  it("formats the assigned reference code", () => {
    expect(formatClientReferenceLabel("CL-8F3K-29QX")).toBe(
      "Client CL-8F3K-29QX",
    );
  });

  it("requires a non-empty reference code", () => {
    expect(() => formatClientReferenceLabel("")).toThrow(
      "clientReferenceCode is required",
    );
  });
});
