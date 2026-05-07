/**
 * Tests for `s3EncryptionParams()` — the helper that splats SSE-KMS
 * params into PutObjectCommand inputs.
 *
 * Coverage:
 *   • returns {} when S3_KMS_KEY_ID is unset (dev/CI fallback to SSE-S3)
 *   • returns the correct shape when S3_KMS_KEY_ID is set
 *   • trims surrounding whitespace
 *   • PutObjectCommand built with the splat carries the SSE-KMS fields
 *     in its `input` (mirroring the call sites in branding-uploads /
 *     intake-audio-uploads)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3EncryptionParams } from "./encryption-params";

describe("s3EncryptionParams", () => {
  const ORIGINAL = process.env.S3_KMS_KEY_ID;

  beforeEach(() => {
    delete process.env.S3_KMS_KEY_ID;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.S3_KMS_KEY_ID;
    } else {
      process.env.S3_KMS_KEY_ID = ORIGINAL;
    }
  });

  it("returns an empty object when S3_KMS_KEY_ID is unset", () => {
    expect(s3EncryptionParams()).toEqual({});
  });

  it("returns an empty object when S3_KMS_KEY_ID is the empty string", () => {
    process.env.S3_KMS_KEY_ID = "";
    expect(s3EncryptionParams()).toEqual({});
  });

  it("returns an empty object when S3_KMS_KEY_ID is whitespace-only", () => {
    process.env.S3_KMS_KEY_ID = "   ";
    expect(s3EncryptionParams()).toEqual({});
  });

  it("returns aws:kms + key id when S3_KMS_KEY_ID is set", () => {
    process.env.S3_KMS_KEY_ID = "alias/akili-prod-s3";
    expect(s3EncryptionParams()).toEqual({
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "alias/akili-prod-s3",
    });
  });

  it("trims surrounding whitespace from the key id", () => {
    process.env.S3_KMS_KEY_ID = "  alias/akili-prod-s3  ";
    expect(s3EncryptionParams()).toEqual({
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "alias/akili-prod-s3",
    });
  });

  it("accepts a full KMS key ARN", () => {
    const arn =
      "arn:aws:kms:us-east-2:123456789012:key/abcd1234-ab12-cd34-ef56-abcdef123456";
    process.env.S3_KMS_KEY_ID = arn;
    expect(s3EncryptionParams()).toEqual({
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: arn,
    });
  });

  describe("when splatted into PutObjectCommand", () => {
    it("omits SSE fields from command.input when key is unset", () => {
      const cmd = new PutObjectCommand({
        Bucket: "test-bucket",
        Key: "test-key",
        Body: new Uint8Array([1, 2, 3]),
        ContentType: "application/octet-stream",
        ContentLength: 3,
        ...s3EncryptionParams(),
      });

      expect(cmd.input.Bucket).toBe("test-bucket");
      expect(cmd.input.Key).toBe("test-key");
      expect(cmd.input.ServerSideEncryption).toBeUndefined();
      expect(cmd.input.SSEKMSKeyId).toBeUndefined();
    });

    it("populates SSE fields on command.input when key is set", () => {
      process.env.S3_KMS_KEY_ID = "alias/akili-prod-s3";

      const cmd = new PutObjectCommand({
        Bucket: "test-bucket",
        Key: "test-key",
        Body: new Uint8Array([1, 2, 3]),
        ContentType: "application/octet-stream",
        ContentLength: 3,
        ...s3EncryptionParams(),
      });

      expect(cmd.input.ServerSideEncryption).toBe("aws:kms");
      expect(cmd.input.SSEKMSKeyId).toBe("alias/akili-prod-s3");
    });
  });
});
