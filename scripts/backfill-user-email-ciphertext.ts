/**
 * Round-11 commit 2.3 (BRD §5.1.AUTH / phase A) — User.email ciphertext backfill.
 *
 * Reads every User row whose `emailCiphertext` is still null, computes the
 * deterministic AES-256-GCM ciphertext via the same `encryptDeterministic`
 * helper used at write time, and writes it back. Idempotent — safe to re-run
 * after partial failure.
 *
 * Run:
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
 */

import { prisma } from "../src/lib/db";
import { userEmailCiphertext } from "../src/lib/auth/user-email";

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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `[backfill-user-email-ciphertext] starting — batchSize=${opts.batchSize} dry=${opts.dryRun}`
  );

  // Use a typed cast around the column name because the locally-generated
  // Prisma client may be out-of-date during the rollout window. The actual
  // SQL in migration `20260507180000_user_email_ciphertext_phase_a` adds the
  // column.
  const where = { emailCiphertext: null } as never;

  const totalToBackfill = await prisma.user.count({ where });
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
    const rows = await prisma.user.findMany({
      where,
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: opts.batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
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
        data: { emailCiphertext: ciphertext } as never,
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
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
