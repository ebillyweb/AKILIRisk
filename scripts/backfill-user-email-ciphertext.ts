/**
 * Round-11 commit 2.3 (BRD §5.1.AUTH / phase A) — User.email ciphertext backfill.
 *
 * Reads every User row whose `emailCiphertext` is still null (Phase A DB),
 * computes the deterministic AES-256-GCM ciphertext via `userEmailCiphertext`,
 * and writes it back. Idempotent — safe to re-run after partial failure.
 *
 * Count / batch **SELECT** use `$queryRaw` so this still works after the
 * Prisma schema marks `emailCiphertext` as non-null: Prisma's query engine
 * rejects `where: { emailCiphertext: null }` for a required `String` field,
 * but PostgreSQL can still have NULLs until the backfill + NOT NULL land.
 *
 * Run **from the repo root** (so `scripts/lib/prisma-for-scripts` can read
 * `.env.local` / `.env`). Env is loaded via `./load-repo-env` like other TS
 * scripts — without it, `DATABASE_URL` is unset and Prisma hits localhost →
 * `ECONNREFUSED`.
 *
 *     npx tsx scripts/backfill-user-email-ciphertext.ts
 *
 * Optional flags:
 *   --batch=N   batch size for the update loop (default 200)
 *   --dry       report counts without writing
 *
 * The script intentionally does NOT use the `findUserByEmail` shim — that
 * helper is for application code that needs to handle a partially-backfilled
 * column. Here we're the ones doing the backfill, so we go straight at the
 * column with raw Prisma calls.
 *
 * Phase B (commit 2.4) is gated on this backfill having completed in
 * production: the SQL-level NOT NULL constraint will fail if any row still
 * has emailCiphertext = null.
 *
 * **Prerequisite:** migration `20260507180000_user_email_ciphertext_phase_a`
 * must be applied so `"User"."emailCiphertext"` exists. If Postgres returns
 * `column "emailCiphertext" does not exist`, run `npx prisma migrate deploy`
 * (or `migrate dev`) against this `DATABASE_URL` first.
 */

import "./load-repo-env";
import { Prisma } from "@prisma/client";
import { prisma, disconnectPrismaScript } from "./lib/prisma-for-scripts";
import { userEmailCiphertext } from "../src/lib/auth/user-email-crypto";

interface RunOpts {
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): RunOpts {
  let batchSize = 200;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry" || arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--batch=")) {
      const n = Number(arg.slice("--batch=".length));
      if (Number.isFinite(n) && n > 0) batchSize = Math.floor(n);
    }
  }
  return { batchSize, dryRun };
}

/** Fails fast with a clear message if the phase-A column was never migrated. */
async function assertUserEmailCiphertextColumn(): Promise<void> {
  const [{ n }] = await prisma.$queryRaw<[{ n: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS n
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public'
        AND c.relname = 'User'
        AND a.attname = 'emailCiphertext'
        AND a.attnum > 0
        AND NOT a.attisdropped
    `
  );
  if (Number(n) === 0) {
    throw new Error(
      'Missing "User"."emailCiphertext" — apply Prisma migrations first (at least 20260507180000_user_email_ciphertext_phase_a). Example: npx prisma migrate deploy'
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `[backfill-user-email-ciphertext] starting — batchSize=${opts.batchSize} dry=${opts.dryRun}`
  );

  await assertUserEmailCiphertextColumn();

  const [countRow] = await prisma.$queryRaw<[{ c: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "User"
      WHERE "emailCiphertext" IS NULL
        AND "email" IS NOT NULL
    `
  );
  const totalToBackfill = Number(countRow.c);
  console.log(
    `[backfill-user-email-ciphertext] ${totalToBackfill} row(s) need backfill`
  );

  if (totalToBackfill === 0) {
    console.log("[backfill-user-email-ciphertext] nothing to do — exiting");
    return;
  }

  if (opts.dryRun) {
    console.log("[backfill-user-email-ciphertext] dry run — exiting before writes");
    return;
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  // Loop forever; we exit when a fetch returns < batchSize rows.
  // We use `take` + `id ASC` rather than skip/offset so the work is
  // O(N) regardless of how many rows have already been backfilled.
  let cursor: string | null = null;
  for (;;) {
    const rows = await prisma.$queryRaw<Array<{ id: string; email: string | null }>>(
      cursor
        ? Prisma.sql`
            SELECT id, email
            FROM "User"
            WHERE "emailCiphertext" IS NULL
              AND "email" IS NOT NULL
              AND id > ${cursor}
            ORDER BY id ASC
            LIMIT ${opts.batchSize}
          `
        : Prisma.sql`
            SELECT id, email
            FROM "User"
            WHERE "emailCiphertext" IS NULL
              AND "email" IS NOT NULL
            ORDER BY id ASC
            LIMIT ${opts.batchSize}
          `
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      processed++;
      if (!row.email) {
        skipped++;
        continue;
      }
      const ciphertext = userEmailCiphertext(row.email);
      await prisma.user.update({
        where: { id: row.id },
        data: { emailCiphertext: ciphertext },
      });
      updated++;
    }

    cursor = rows[rows.length - 1].id;
    console.log(
      `[backfill-user-email-ciphertext] progress: processed=${processed} updated=${updated} skipped=${skipped}`
    );
    if (rows.length < opts.batchSize) break;
  }

  console.log(
    `[backfill-user-email-ciphertext] done — processed=${processed} updated=${updated} skipped=${skipped}`
  );
}

main()
  .catch((err) => {
    console.error("[backfill-user-email-ciphertext] failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (
      typeof msg === "string" &&
      (msg.includes("emailCiphertext") || msg.includes("42703")) &&
      msg.includes("does not exist")
    ) {
      console.error(
        "[backfill-user-email-ciphertext] hint: run migrations against this DATABASE_URL (npx prisma migrate deploy), then retry."
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaScript();
  });
