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
  decryptUserEmail,
  findUserByEmail,
  userEmailCiphertext,
  userEmailForDisplay,
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

describe("decryptUserEmail / userEmailForDisplay", () => {
  it("decryptUserEmail round-trips with userEmailCiphertext", () => {
    const ct = userEmailCiphertext("kate@example.com");
    expect(decryptUserEmail(ct)).toBe("kate@example.com");
  });

  it("userEmailForDisplay prefers the plaintext column when populated", () => {
    const ct = userEmailCiphertext("liam@example.com");
    const result = userEmailForDisplay({
      email: "liam@example.com",
      emailCiphertext: ct,
    });
    expect(result).toBe("liam@example.com");
  });

  it("userEmailForDisplay decrypts when plaintext column is null", () => {
    const ct = userEmailCiphertext("mia@example.com");
    const result = userEmailForDisplay({ email: null, emailCiphertext: ct });
    expect(result).toBe("mia@example.com");
  });
});

describe("userEmailWriteData", () => {
  // Round-11 commit 2.4a: writes ciphertext only — the plaintext
  // `email` column is no longer authoritative; new rows get NULL
  // there. Existing rows keep their plaintext for the bake window
  // but writes don't touch the column anymore.
  it("returns the ciphertext column ready to splat into a Prisma data: object", () => {
    const out = userEmailWriteData("carol@example.com");
    expect(out.emailCiphertext).toBe(userEmailCiphertext("carol@example.com"));
  });

  it("does not write the plaintext email column", () => {
    const out = userEmailWriteData("dave@example.com") as Record<string, unknown>;
    expect(out.email).toBeUndefined();
    expect(Object.keys(out)).toEqual(["emailCiphertext"]);
  });
});

// Round-11 commit 2.4a: post-flip, findUserByEmail issues a SINGLE
// findFirst keyed on emailCiphertext. The plaintext-fallback branch
// from phase A is gone — the migration enforces NOT NULL on the
// ciphertext column so every row matches.
describe("findUserByEmail", () => {
  it("returns the row via the ciphertext lookup", async () => {
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
    // Single query — no plaintext fallback after 2.4a.
    expect(fakeFindFirst).toHaveBeenCalledTimes(1);
    const firstCall = fakeFindFirst.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(firstCall.where.emailCiphertext).toBe(ct);
    // No plaintext branch ran.
    expect(firstCall.where.email).toBeUndefined();
  });

  it("returns null when the ciphertext lookup misses", async () => {
    const got = await findUserByEmail("ghost@example.com");
    expect(got).toBeNull();
    // Still single-query — null result doesn't trigger a fallback.
    expect(fakeFindFirst).toHaveBeenCalledTimes(1);
  });

  it("merges extra `where` filters into the lookup (e.g. deletedAt: null)", async () => {
    fakeRows.push({
      id: "u-3",
      email: "hank@example.com",
      emailCiphertext: userEmailCiphertext("hank@example.com"),
      deletedAt: new Date(), // soft-deleted
      role: "USER",
    });

    const got = await findUserByEmail("hank@example.com", {
      where: { deletedAt: null },
    });
    expect(got).toBeNull();
    expect(fakeFindFirst).toHaveBeenCalledTimes(1);
    const args = fakeFindFirst.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.deletedAt).toBeNull();
  });

  it("forwards `select` to the lookup", async () => {
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
