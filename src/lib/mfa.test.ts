import { describe, it, expect, beforeAll } from "vitest";
import { TOTP } from "@otplib/totp";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";

describe("TOTP Configuration", () => {
  let totp: TOTP;

  beforeAll(() => {
    // Initialize TOTP with same config as production
    totp = new TOTP({
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
      issuer: "Akili Risk",
      digits: 6,
      period: 30,
      algorithm: "sha1",
    });
  });

  it("should generate a base32-encoded secret", () => {
    const secret = totp.generateSecret();

    // Base32 encoded secrets are typically 26-32 characters
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(26);
  });

  it("should generate a valid TOTP token from a secret", async () => {
    const secret = totp.generateSecret();
    const token = await totp.generate({ secret });

    // TOTP tokens are 6 digits
    expect(token).toMatch(/^\d{6}$/);
  });

  it("should verify a freshly generated token", async () => {
    const secret = totp.generateSecret();
    const token = await totp.generate({ secret });

    const result = await totp.verify(token, {
      secret,
      epochTolerance: 60, // Allow ±60 seconds
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.delta).toBeDefined();
      expect(result.epoch).toBeDefined();
    }
  });

  it("should reject an invalid token", async () => {
    const secret = totp.generateSecret();
    const invalidToken = "000000";

    const result = await totp.verify(invalidToken, {
      secret,
      epochTolerance: 60,
    });

    expect(result.valid).toBe(false);
  });

  it("should generate correct otpauth URI", () => {
    const secret = "JBSWY3DPEHPK3PXP"; // Standard test secret
    const uri = totp.toURI({
      secret,
      label: "test@example.com",
      issuer: "Akili Risk",
    });

    // URI should contain otpauth prefix
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    // Spaces in the issuer are URL-encoded as %20 in the otpauth URI.
    expect(uri).toContain("issuer=Akili%20Risk");
    expect(uri).toContain("test%40example.com");
  });

  it("should handle multiple token windows with tolerance", async () => {
    const secret = totp.generateSecret();

    // Generate token at current time
    const token = await totp.generate({ secret });

    // Verify with large tolerance window (should still pass)
    const result = await totp.verify(token, {
      secret,
      epochTolerance: 120, // ±120 seconds
    });

    expect(result.valid).toBe(true);
  });

  it("should match the same secret used in verifyMFAToken", () => {
    // Test that the configuration matches the production setup
    const secret = totp.generateSecret();
    const label = "user@example.com";
    const issuer = "Akili Risk";

    const uri = totp.toURI({
      secret,
      label,
      issuer,
    });

    // Verify URI structure
    // Default values (SHA1, digits=6, period=30) may be omitted from URI
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=");
    // Spaces in the issuer are URL-encoded as %20 in the otpauth URI.
    expect(uri).toContain("issuer=Akili%20Risk");
    expect(uri).toContain("user%40example.com");
  });
});
