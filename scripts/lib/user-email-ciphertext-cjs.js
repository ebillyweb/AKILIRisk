/**
 * CommonJS deterministic User.email ciphertext for seed/helper scripts.
 * Must match `userEmailCiphertext` in `src/lib/auth/user-email-crypto.ts`
 * (same scrypt stretch, HMAC IV, AES-256-GCM format as `encryptDeterministic`).
 */
const crypto = require("crypto");

function deriveAesKey() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  return crypto.scryptSync(encryptionKey, "salt", 32);
}

/** @param {string} email */
function userEmailCiphertext(email) {
  const plaintext = email.trim().toLowerCase();
  const key = deriveAesKey();
  const iv = crypto
    .createHmac("sha256", "User.email")
    .update(plaintext, "utf8")
    .digest()
    .subarray(0, 16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

module.exports = { userEmailCiphertext };
