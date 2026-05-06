import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Round-11 commit 2 (BRD §5.1.AUTH): tests for the magic-link helpers.
 *
 * Mocks Prisma so the tests are pure-in-memory. Asserts:
 *   - issueMagicLinkToken creates a row with a hashed token; returns the
 *     raw token; expiry defaults to 15 minutes.
 *   - validateMagicLinkToken accepts a fresh token, rejects with the
 *     correct discriminator on missing / used / expired / inactive.
 *   - consumeMagicLinkToken atomically flips used; idempotent under
 *     double-call.
 *   - invalidatePriorMagicLinkTokens deletes only unexpired+unused.
 *   - hashToken is deterministic + matches forgot-password's pattern.
 */

const { prismaSpies } = vi.hoisted(() => ({
  prismaSpies: {
    magicLinkToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import {
  DEFAULT_MAGIC_LINK_TTL_MS,
  generateRawToken,
  hashToken,
  issueMagicLinkToken,
  validateMagicLinkToken,
  consumeMagicLinkToken,
  invalidatePriorMagicLinkTokens,
} from "./magic-link";

beforeEach(() => {
  // Round-11 commit 2.3: validateMagicLinkToken now goes through
  // findUserByEmail, which calls userEmailCiphertext, which needs an
  // ENCRYPTION_KEY. Pin a deterministic test key.
  process.env.ENCRYPTION_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";
  for (const m of Object.values(prismaSpies)) {
    if (typeof m === "object") {
      for (const fn of Object.values(m as Record<string, ReturnType<typeof vi.fn>>)) {
        if (typeof fn === "function" && "mockReset" in fn) (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
  }
});

describe("hashToken", () => {
  it("returns a 64-char hex string", () => {
    const h = hashToken("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic for the same input", () => {
    expect(hashToken("hello")).toBe(hashToken("hello"));
  });
  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("generateRawToken", () => {
  it("returns a 64-char hex string (32 random bytes)", () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it("returns a different value each call", () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe("issueMagicLinkToken", () => {
  it("creates a row with the hashed token, returns the raw token + 15-min expiry", async () => {
    const before = Date.now();
    prismaSpies.magicLinkToken.create.mockImplementation(async ({ data }) => ({
      id: "mlt-1",
      expires: data.expires,
    }));

    const issued = await issueMagicLinkToken("alice@example.com");

    expect(issued.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.tokenId).toBe("mlt-1");
    const expiryMs = issued.expires.getTime() - before;
    expect(expiryMs).toBeGreaterThanOrEqual(DEFAULT_MAGIC_LINK_TTL_MS - 100);
    expect(expiryMs).toBeLessThanOrEqual(DEFAULT_MAGIC_LINK_TTL_MS + 100);

    const createCall = prismaSpies.magicLinkToken.create.mock.calls[0][0];
    expect(createCall.data.tokenHash).toBe(hashToken(issued.rawToken));
    expect(createCall.data.email).toBe("alice@example.com");
    expect(createCall.data.inviteCodeId).toBeNull();
  });

  it("threads through inviteCodeId when supplied", async () => {
    prismaSpies.magicLinkToken.create.mockResolvedValue({ id: "mlt-2", expires: new Date() });
    await issueMagicLinkToken("bob@example.com", { inviteCodeId: "ic-1" });
    const createCall = prismaSpies.magicLinkToken.create.mock.calls[0][0];
    expect(createCall.data.inviteCodeId).toBe("ic-1");
  });

  it("respects an explicit expiresAt override (test-only escape hatch)", async () => {
    const customExpiry = new Date("2030-01-01T00:00:00Z");
    prismaSpies.magicLinkToken.create.mockImplementation(async ({ data }) => ({
      id: "mlt-3",
      expires: data.expires,
    }));
    const issued = await issueMagicLinkToken("carol@example.com", { expiresAt: customExpiry });
    expect(issued.expires.toISOString()).toBe(customExpiry.toISOString());
  });
});

describe("validateMagicLinkToken", () => {
  it("returns not_found when token row is missing", async () => {
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue(null);
    const r = await validateMagicLinkToken("rawtoken-abc");
    expect(r).toEqual({ success: false, reason: "not_found" });
  });

  it("returns not_found for empty/non-string input (defensive)", async () => {
    expect(await validateMagicLinkToken("")).toEqual({ success: false, reason: "not_found" });
    // @ts-expect-error testing the runtime guard
    expect(await validateMagicLinkToken(null)).toEqual({ success: false, reason: "not_found" });
  });

  it("returns used when the token row is already consumed", async () => {
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      id: "mlt-1",
      email: "a@x.com",
      inviteCodeId: null,
      expires: new Date(Date.now() + 1000),
      used: true,
    });
    const r = await validateMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: false, reason: "used" });
  });

  it("returns expired when expires < now", async () => {
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      id: "mlt-1",
      email: "a@x.com",
      inviteCodeId: null,
      expires: new Date(Date.now() - 1000),
      used: false,
    });
    const r = await validateMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: false, reason: "expired" });
  });

  it("returns user_inactive when no User row matches the email and no invite is set", async () => {
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      id: "mlt-1",
      email: "ghost@example.com",
      inviteCodeId: null,
      expires: new Date(Date.now() + 60_000),
      used: false,
    });
    prismaSpies.user.findFirst.mockResolvedValue(null);
    const r = await validateMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: false, reason: "user_inactive" });
  });

  it("returns success when User exists + token is fresh + unused", async () => {
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      id: "mlt-1",
      email: "alice@example.com",
      inviteCodeId: null,
      expires: new Date(Date.now() + 60_000),
      used: false,
    });
    prismaSpies.user.findFirst.mockResolvedValue({ id: "u-1" });
    const r = await validateMagicLinkToken("rawtoken");
    expect(r).toEqual({
      success: true,
      tokenId: "mlt-1",
      email: "alice@example.com",
      inviteCodeId: null,
    });
  });

  it("skips the User existence check for invitation-flow tokens (User may not exist yet)", async () => {
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      id: "mlt-1",
      email: "newclient@example.com",
      inviteCodeId: "ic-1",
      expires: new Date(Date.now() + 60_000),
      used: false,
    });

    const r = await validateMagicLinkToken("rawtoken");
    expect(r).toEqual({
      success: true,
      tokenId: "mlt-1",
      email: "newclient@example.com",
      inviteCodeId: "ic-1",
    });
    // user.findFirst should NOT have been consulted because inviteCodeId
    // is set — commit-2 contract: invitation tokens validate without
    // requiring a pre-existing User row.
    expect(prismaSpies.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("consumeMagicLinkToken", () => {
  it("flips used=true and returns email + inviteCodeId on success", async () => {
    prismaSpies.magicLinkToken.updateMany.mockResolvedValue({ count: 1 });
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      email: "a@x.com",
      inviteCodeId: "ic-1",
    });
    const r = await consumeMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: true, email: "a@x.com", inviteCodeId: "ic-1" });
    const updateCall = prismaSpies.magicLinkToken.updateMany.mock.calls[0][0];
    expect(updateCall.where.used).toBe(false);
    expect(updateCall.data.used).toBe(true);
    expect(updateCall.data.consumedAt).toBeInstanceOf(Date);
  });

  it("returns used on second call (race-safe via updateMany predicate)", async () => {
    // First call: won the race, updateMany hit 1.
    // Second call: updateMany hits 0 (where used=false now matches nothing
    // because the row was consumed). The disambiguation read finds used=true.
    prismaSpies.magicLinkToken.updateMany.mockResolvedValue({ count: 0 });
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      used: true,
      expires: new Date(Date.now() + 60_000),
    });
    const r = await consumeMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: false, reason: "used" });
  });

  it("returns expired when the row exists but is expired", async () => {
    prismaSpies.magicLinkToken.updateMany.mockResolvedValue({ count: 0 });
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue({
      used: false,
      expires: new Date(Date.now() - 1000),
    });
    const r = await consumeMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: false, reason: "expired" });
  });

  it("returns not_found when the row never existed", async () => {
    prismaSpies.magicLinkToken.updateMany.mockResolvedValue({ count: 0 });
    prismaSpies.magicLinkToken.findUnique.mockResolvedValue(null);
    const r = await consumeMagicLinkToken("rawtoken");
    expect(r).toEqual({ success: false, reason: "not_found" });
  });
});

describe("invalidatePriorMagicLinkTokens", () => {
  it("deletes prior unexpired+unused rows for the email", async () => {
    prismaSpies.magicLinkToken.deleteMany.mockResolvedValue({ count: 2 });
    const n = await invalidatePriorMagicLinkTokens("alice@example.com");
    expect(n).toBe(2);
    const where = prismaSpies.magicLinkToken.deleteMany.mock.calls[0][0].where;
    expect(where.email).toBe("alice@example.com");
    expect(where.used).toBe(false);
    expect(where.expires.gt).toBeInstanceOf(Date);
  });
});
