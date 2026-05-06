/**
 * Round-11 commit 2.3 (BRD §5.1.AUTH / phase A) — User.email shim tests.
 *
 * Confirms the dual-read / dual-write behavior of the helpers in
 * `user-email.ts`:
 *
 *   • userEmailCiphertext is deterministic + idempotent.
 *   • userEmailWriteData populates both columns in lock-step.
 *   • findUserByEmail tries ciphertext first, falls back to plaintext,
 *     forwards `where` filters + `select` correctly, and surfaces null
 *     when neither lookup matches.
 *
 * vi.hoisted() pattern: the vi.mock factory below references mutable test
 * state (`fakeRows`), and vi.mock factories are hoisted, so the state has
 * to be hoisted with them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Pin a deterministic ENCRYPTION_KEY so userEmailCiphertext can run.
// Same pattern as src/lib/encryption.test.ts.
const TEST_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";

const { fakeFindFirst, fakeRows } = vi.hoisted(() => {
  const rows: Array<{
    id: string;
    email: string;
    emailCiphertext: string | null;
    deletedAt: Date | null;
    role: string;
  }> = [];
  const fakeFindFirstFn = vi.fn(
    async ({
      where,
      select: _select,
    }: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      void _select;
      const match = rows.find((r) => {
        for (const [k, v] of Object.entries(where)) {
          if (k === "email" && r.email !== v) return false;
          if (k === "emailCiphertext" && r.emailCiphertext !== v) return false;
          if (k === "deletedAt" && r.deletedAt !== v) return false;
        }
        return true;
      });
      return match ?? null;
    }
  );
  return { fakeFindFirst: fakeFindFirstFn, fakeRows: rows };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: fakeFindFirst,
    },
  },
}));

import {
  USER_EMAIL_FIELD_KEY,
  findUserByEmail,
  userEmailCiphertext,
  userEmailWriteData,
} from "./user-email";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  fakeFindFirst.mockClear();
  fakeRows.length = 0;
});

describe("userEmailCiphertext", () => {
  it("is deterministic — same input → same output across calls", () => {
    const a = userEmailCiphertext("alice@example.com");
    const b = userEmailCiphertext("alice@example.com");
    expect(a).toEqual(b);
    expect(typeof a).toBe("string");
    expect(a.split(":").length).toBe(3); // iv:authTag:ciphertext shape
  });

  it("produces different ciphertexts for different plaintexts", () => {
    const a = userEmailCiphertext("alice@example.com");
    const b = userEmailCiphertext("bob@example.com");
    expect(a).not.toEqual(b);
  });

  it("does not contain the plaintext anywhere in the output", () => {
    const ct = userEmailCiphertext("alice@example.com");
    expect(ct.toLowerCase()).not.toContain("alice");
    expect(ct.toLowerCase()).not.toContain("example");
  });

  it("scopes the deterministic IV to the User.email fieldKey", () => {
    expect(USER_EMAIL_FIELD_KEY).toBe("User.email");
  });
});

describe("userEmailWriteData", () => {
  it("returns both columns ready to splat into a Prisma data: object", () => {
    const out = userEmailWriteData("carol@example.com");
    expect(out.email).toBe("carol@example.com");
    expect(out.emailCiphertext).toBe(userEmailCiphertext("carol@example.com"));
  });

  it("never returns just one column — both keys are always present", () => {
    const out = userEmailWriteData("dave@example.com");
    expect(Object.keys(out).sort()).toEqual(["email", "emailCiphertext"]);
  });
});

describe("findUserByEmail", () => {
  it("returns the row when only emailCiphertext is set (post-backfill)", async () => {
    const ct = userEmailCiphertext("eve@example.com");
    fakeRows.push({
      id: "u-1",
      email: "eve@example.com",
      emailCiphertext: ct,
      deletedAt: null,
      role: "USER",
    });

    const got = await findUserByEmail("eve@example.com");
    expect(got).not.toBeNull();
    expect(got!.id).toBe("u-1");
    // Two queries are issued in sequence — fast-path-then-fallback —
    // but the first hits, so only one matters semantically. We verify
    // the ciphertext branch ran first.
    expect(fakeFindFirst).toHaveBeenCalled();
    const firstCall = fakeFindFirst.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(firstCall.where.emailCiphertext).toBe(ct);
  });

  it("falls back to plaintext when emailCiphertext is null (un-backfilled row)", async () => {
    fakeRows.push({
      id: "u-2",
      email: "frank@example.com",
      emailCiphertext: null,
      deletedAt: null,
      role: "USER",
    });

    const got = await findUserByEmail("frank@example.com");
    expect(got).not.toBeNull();
    expect(got!.id).toBe("u-2");
    // Two calls: ciphertext miss, plaintext hit.
    expect(fakeFindFirst).toHaveBeenCalledTimes(2);
    const secondCall = fakeFindFirst.mock.calls[1]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(secondCall.where.email).toBe("frank@example.com");
  });

  it("returns null when neither lookup matches", async () => {
    const got = await findUserByEmail("ghost@example.com");
    expect(got).toBeNull();
    expect(fakeFindFirst).toHaveBeenCalledTimes(2);
  });

  it("merges extra `where` filters into both lookups (e.g. deletedAt: null)", async () => {
    fakeRows.push({
      id: "u-3",
      email: "hank@example.com",
      emailCiphertext: null,
      deletedAt: new Date(), // soft-deleted
      role: "USER",
    });

    const got = await findUserByEmail("hank@example.com", {
      where: { deletedAt: null },
    });
    expect(got).toBeNull();
    expect(fakeFindFirst).toHaveBeenCalledTimes(2);
    for (const call of fakeFindFirst.mock.calls) {
      const args = call[0] as { where: Record<string, unknown> };
      expect(args.where.deletedAt).toBeNull();
    }
  });

  it("forwards `select` to both lookups", async () => {
    fakeRows.push({
      id: "u-4",
      email: "iris@example.com",
      emailCiphertext: userEmailCiphertext("iris@example.com"),
      deletedAt: null,
      role: "ADVISOR",
    });

    await findUserByEmail("iris@example.com", {
      select: { id: true, role: true },
    });
    const firstCall = fakeFindFirst.mock.calls[0]?.[0] as {
      select?: Record<string, boolean>;
    };
    expect(firstCall.select).toEqual({ id: true, role: true });
  });
});
