import { describe, expect, it } from "vitest";

import {
  formatClientReferenceLabel,
  generateClientReferenceCode,
  validateCustomClientReferenceCode,
  normalizeCustomClientReferenceCode,
  MIN_CUSTOM_CODE_LENGTH,
  MAX_CUSTOM_CODE_LENGTH,
} from "@/lib/client/client-reference-code";

describe("generateClientReferenceCode", () => {
  it("generates a 5-character alphanumeric code", () => {
    const code = generateClientReferenceCode();
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect(code.length).toBe(5);
  });

  it("generates unique codes on subsequent calls", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateClientReferenceCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("formatClientReferenceLabel", () => {
  it("formats the assigned reference code", () => {
    expect(formatClientReferenceLabel("Y47KX")).toBe("Client Y47KX");
  });

  it("supports legacy CL-prefixed codes", () => {
    expect(formatClientReferenceLabel("CL-8F3K-29QX")).toBe("Client CL-8F3K-29QX");
  });

  it("requires a non-empty reference code", () => {
    expect(() => formatClientReferenceLabel("")).toThrow(
      "clientReferenceCode is required",
    );
  });
});

describe("validateCustomClientReferenceCode", () => {
  it("accepts valid alphanumeric codes", () => {
    expect(validateCustomClientReferenceCode("ABC123")).toBeNull();
    expect(validateCustomClientReferenceCode("MS-12345")).toBeNull();
    expect(validateCustomClientReferenceCode("CRM_REF_001")).toBeNull();
  });

  it("rejects codes that are too short", () => {
    expect(validateCustomClientReferenceCode("AB")).toBe(
      `Client ID must be at least ${MIN_CUSTOM_CODE_LENGTH} characters`
    );
  });

  it("rejects codes that are too long", () => {
    const longCode = "A".repeat(MAX_CUSTOM_CODE_LENGTH + 1);
    expect(validateCustomClientReferenceCode(longCode)).toBe(
      `Client ID must be at most ${MAX_CUSTOM_CODE_LENGTH} characters`
    );
  });

  it("rejects codes with invalid characters", () => {
    expect(validateCustomClientReferenceCode("ABC@123")).toBe(
      "Client ID can only contain letters, numbers, dashes, and underscores"
    );
    expect(validateCustomClientReferenceCode("ABC 123")).toBe(
      "Client ID can only contain letters, numbers, dashes, and underscores"
    );
  });

  it("rejects empty codes", () => {
    expect(validateCustomClientReferenceCode("")).toBe("Client ID is required");
    expect(validateCustomClientReferenceCode("   ")).toBe("Client ID is required");
  });
});

describe("normalizeCustomClientReferenceCode", () => {
  it("uppercases the code", () => {
    expect(normalizeCustomClientReferenceCode("abc123")).toBe("ABC123");
  });

  it("trims whitespace", () => {
    expect(normalizeCustomClientReferenceCode("  ABC123  ")).toBe("ABC123");
  });
});
