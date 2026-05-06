import { TOTP } from "@otplib/totp";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { toDataURL } from "qrcode";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { userEmailForDisplay } from "@/lib/auth/user-email";

// Initialize TOTP with Noble crypto and Scure Base32 plugins
//
// Brand rename note: issuer string controls the label shown in users'
// authenticator apps (e.g. "Akili Risk: alice@example.com"). This change
// affects NEW enrollments only — existing TOTP secrets in users'
// authenticator apps continue to display whatever label they were
// enrolled with (the underlying secret is what verifies, not the label).
// Users who want the updated label must delete + re-enroll. Pre-rename
// label was "Belvedere".
const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  issuer: "Akili Risk",
  digits: 6,
  period: 30,
  algorithm: "sha1",
});

/**
 * Enroll user in MFA by generating TOTP secret and QR code
 * Does NOT enable MFA yet - user must verify TOTP first
 */
export async function enrollMFA(userId: string) {
  // Generate TOTP secret using built-in method
  const secret = totp.generateSecret();
  console.debug("[MFA] Generated TOTP secret", {
    secretLength: secret.length,
    secretFormat: "base32",
  });

  // Encrypt secret before storing
  let encryptedSecret: string;
  try {
    encryptedSecret = encrypt(secret);
    console.debug("[MFA] Successfully encrypted secret");
  } catch (encryptError) {
    console.error("[MFA] Failed to encrypt secret:", encryptError);
    throw encryptError;
  }

  // Round-11 commit 2.4b: column dropped; only emailCiphertext.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailCiphertext: true },
  });

  if (!user) {
    throw new Error("User not found");
  }
  const userEmail = userEmailForDisplay(user);

  // Store encrypted secret (but don't enable MFA yet)
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: encryptedSecret },
  });
  console.debug("[MFA] Stored encrypted secret for user");

  // Generate otpauth URI using built-in method
  const otpauthUrl = totp.toURI({
    secret,
    label: userEmail,
    issuer: "Akili Risk",
  });
  console.debug("[MFA] Generated otpauth URI");

  // Generate QR code data URL
  const qrCodeUrl = await toDataURL(otpauthUrl);
  console.debug("[MFA] Generated QR code");

  return {
    qrCodeUrl,
    secret, // Return plaintext for manual entry
  };
}

/**
 * Verify TOTP token against user's MFA secret
 * Allows 1 time-step window (30s drift)
 */
export async function verifyMFAToken(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true },
  });

  if (!user?.mfaSecret) {
    console.debug("[TOTP] User has no MFA secret stored");
    return false;
  }

  // Decrypt secret
  let secret: string;
  try {
    secret = decrypt(user.mfaSecret);
    console.debug("[TOTP] Successfully decrypted secret", {
      secretLength: secret.length,
      encryptedLength: user.mfaSecret.length,
    });
  } catch (decryptError) {
    console.error("[TOTP] Failed to decrypt secret:", decryptError);
    return false;
  }

  // Validate token format
  if (!token || typeof token !== "string") {
    console.debug("[TOTP] Invalid token - not a string:", typeof token);
    return false;
  }

  if (!/^\d{6}$/.test(token)) {
    console.debug("[TOTP] Invalid token format. Expected 6 digits, got:", {
      token,
      length: token.length,
    });
    return false;
  }

  // Verify token with tolerance window (60 seconds = 2 periods, past and future)
  try {
    console.debug("[TOTP] Starting verification", {
      token,
      secretLength: secret.length,
      tolerance: "60 seconds (±1 period)",
    });

    // TOTP class instance has crypto and base32 plugins pre-configured
    // verify(token, options) where options are partial overrides
    const result = await totp.verify(token, {
      secret,
      epochTolerance: 60, // 60 seconds = 2 x 30-second periods
    });

    console.debug("[TOTP] Verification result:", {
      valid: result.valid,
      delta: result.valid ? (result as any).delta : undefined,
      epoch: result.valid ? (result as any).epoch : undefined,
    });

    return result.valid === true;
  } catch (error) {
    console.error("[TOTP] Verification error:", {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

/**
 * Enable MFA after verifying TOTP token
 * Generates recovery codes and returns them
 */
export async function enableMFA(userId: string, token: string) {
  // Verify token first
  const isValid = await verifyMFAToken(userId, token);

  if (!isValid) {
    throw new Error("Invalid TOTP token");
  }

  // Generate 10 recovery codes (8-char hex)
  const recoveryCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString("hex");
    recoveryCodes.push(code);

    // Hash with SHA-256 before storing
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    hashedCodes.push(hash);
  }

  // Enable MFA and store hashed recovery codes
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaRecoveryCodes: hashedCodes,
    },
  });

  // Return plaintext codes (shown ONCE to user)
  return recoveryCodes;
}

/**
 * Verify and consume a recovery code
 * Recovery codes are single-use
 */
export async function verifyRecoveryCode(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaRecoveryCodes: true },
  });

  if (!user?.mfaRecoveryCodes) {
    return false;
  }

  // Hash provided code
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  // Check if hash exists in recovery codes array
  const codes = user.mfaRecoveryCodes as string[];
  const index = codes.indexOf(hash);

  if (index === -1) {
    return false;
  }

  // Remove used code (single-use)
  const updatedCodes = codes.filter((_, i) => i !== index);

  await prisma.user.update({
    where: { id: userId },
    data: { mfaRecoveryCodes: updatedCodes },
  });

  return true;
}
