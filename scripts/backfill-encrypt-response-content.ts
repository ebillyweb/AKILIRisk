/**
 * Round-11 commit 2.5a (BRD §5.1) — backfill response-content ciphertext.
 *
 * Reads every `IntakeResponse` row and refreshes the new
 * `hasTranscription` boolean from the (still-plaintext) `transcription`
 * column. Reads every `AssessmentResponse` row whose `answerCiphertext`
 * is null and computes the random-IV AES-GCM ciphertext from the
 * (still-plaintext) `answer` JSON column. Idempotent — safe to re-run
 * after partial failure.
 *
 * Run from the repo root so `scripts/lib/prisma-for-scripts` can read
 * `.env.local` / `.env`. Env is loaded via `./load-repo-env`.
 *
 *     npx tsx scripts/backfill-encrypt-response-content.ts
 *
 * Optional flags:
 *   --batch=N   batch size for both update loops (default 200)
 *   --dry       report counts without writing
 *
 * The script intentionally goes straight at the columns with raw
 * Prisma calls; it does NOT use the helpers in
 * `src/lib/data/response-content.ts` for the writes (it imports the
 * encrypt helpers but bypasses any ORM-level shimming). Bridge-write
 * application code keeps both columns in sync going forward; this
 * script only rescues pre-existing rows.
 *
 * **Prerequisite:** migration
 * `20260516120000_add_response_content_ciphertext_columns` must be
 * applied so `"AssessmentResponse"."answerCiphertext"` and
 * `"IntakeResponse"."hasTranscription"` exist. If Postgres returns
 * `column "answerCiphertext" does not exist`, run
 * `npx prisma migrate deploy` against this DATABASE_URL first.
 *
 * Phase B (commit 2.5b) is gated on this backfill having completed in
 * production: dropping `answer Json` requires every row to have a
 * non-null `answerCiphertext` (or `skipped = true`), and the
 * `hasTranscription`-driven pipeline filter requires every row's
 * boolean to match the plaintext.
 */

import "./load-repo-env";
import { Prisma } from "@prisma/client";
import { prisma, disconnectPrismaScript } from "./lib/prisma-for-scripts";
import { encryptAnswer, encryptTranscription } from "../src/lib/data/response-content";
import { isCiphertext } from "../src/lib/encryption";

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

/** Fails fast with a clear message if the new columns were never migrated. */
async function assertMigrationApplied(): Promise<void> {
  const [{ n }] = await prisma.$queryRaw<[{ n: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS n
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public'
        AND (
          (c.relname = 'AssessmentResponse' AND a.attname = 'answerCiphertext')
          OR (c.relname = 'IntakeResponse' AND a.attname = 'hasTranscription')
        )
        AND a.attnum > 0
        AND NOT a.attisdropped
    `
  );
  if (Number(n) < 2) {
    throw new Error(
      'Missing one of "AssessmentResponse"."answerCiphertext" / "IntakeResponse"."hasTranscription" — apply Prisma migrations first (at least 20260516120000_add_response_content_ciphertext_columns). Example: npx prisma migrate deploy'
    );
  }
}

async function backfillIntakeResponses(opts: RunOpts): Promise<void> {
  // ── Step 1: keep the denormalized hasTranscription boolean in sync.
  //
  // Tricky: after step 2 below rewrites every transcription value to
  // ciphertext, the literal SQL predicate
  // `length(trim("transcription")) > 0` becomes useless (every
  // ciphertext is a non-empty string). So we run this BEFORE the
  // rewrite — at which point `transcription` is still plaintext and
  // the boolean derivation is trivially correct. After step 2, this
  // recompute would no-op (every ciphertext is non-empty, so every
  // hasTranscription should already be true for non-null rows).
  const [boolCountRow] = await prisma.$queryRaw<[{ c: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "IntakeResponse"
      WHERE "hasTranscription" <> (
        "transcription" IS NOT NULL AND length(trim("transcription")) > 0
      )
        AND ("transcription" IS NULL OR NOT (
          "transcription" ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$'
        ))
    `
  );
  const boolTotal = Number(boolCountRow.c);
  console.log(
    `[backfill-encrypt-response-content] IntakeResponse hasTranscription out of sync: ${boolTotal}`
  );
  if (boolTotal > 0 && !opts.dryRun) {
    const result = await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "IntakeResponse"
        SET "hasTranscription" = (
          "transcription" IS NOT NULL AND length(trim("transcription")) > 0
        )
        WHERE "hasTranscription" <> (
          "transcription" IS NOT NULL AND length(trim("transcription")) > 0
        )
          AND ("transcription" IS NULL OR NOT (
            "transcription" ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$'
          ))
      `
    );
    console.log(
      `[backfill-encrypt-response-content] IntakeResponse hasTranscription: updated ${result} row(s)`
    );
  }

  // ── Step 2: rewrite transcription plaintext → ciphertext in place.
  //
  // Idempotent via the format-shape regex: rows whose value already
  // looks like iv:tag:ct (32 hex : 32 hex : even-hex) are skipped.
  // Per-row UPDATE keeps memory bounded for unusually long
  // transcriptions; cursor-paged loop iterates in id order.
  const [encCountRow] = await prisma.$queryRaw<[{ c: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "IntakeResponse"
      WHERE "transcription" IS NOT NULL
        AND NOT ("transcription" ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$')
    `
  );
  const encTotal = Number(encCountRow.c);
  console.log(
    `[backfill-encrypt-response-content] IntakeResponse rows needing transcription encryption: ${encTotal}`
  );
  if (encTotal === 0 || opts.dryRun) return;

  let cursor: string | null = null;
  let processed = 0;
  let updated = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<Array<{ id: string; transcription: string | null }>>(
      cursor
        ? Prisma.sql`
            SELECT id, transcription
            FROM "IntakeResponse"
            WHERE "transcription" IS NOT NULL
              AND NOT ("transcription" ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$')
              AND id > ${cursor}
            ORDER BY id ASC
            LIMIT ${opts.batchSize}
          `
        : Prisma.sql`
            SELECT id, transcription
            FROM "IntakeResponse"
            WHERE "transcription" IS NOT NULL
              AND NOT ("transcription" ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$')
            ORDER BY id ASC
            LIMIT ${opts.batchSize}
          `
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      processed++;
      if (row.transcription === null) continue;
      // Defense in depth: skip any row whose value happens to
      // already pass isCiphertext (the SQL regex is the primary
      // guard but isCiphertext is the canonical app-level check).
      if (isCiphertext(row.transcription)) continue;

      const ciphertext = encryptTranscription(row.transcription);
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "IntakeResponse"
          SET "transcription" = ${ciphertext}
          WHERE id = ${row.id}
        `
      );
      updated++;
    }

    cursor = rows[rows.length - 1].id;
    console.log(
      `[backfill-encrypt-response-content] IntakeResponse transcription progress: processed=${processed} updated=${updated}`
    );
    if (rows.length < opts.batchSize) break;
  }
}

async function backfillAssessmentResponses(opts: RunOpts): Promise<void> {
  const [countRow] = await prisma.$queryRaw<[{ c: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "AssessmentResponse"
      WHERE "answerCiphertext" IS NULL
        AND "skipped" = false
    `
  );
  const total = Number(countRow.c);
  console.log(
    `[backfill-encrypt-response-content] AssessmentResponse rows needing ciphertext: ${total}`
  );
  if (total === 0 || opts.dryRun) return;

  // Cursor-paged loop. We fetch (id, answer) batches and write back the
  // ciphertext one row at a time. Per-row UPDATE keeps memory bounded
  // even for unusually large `answer` JSON payloads.
  let cursor: string | null = null;
  let processed = 0;
  let updated = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<Array<{ id: string; answer: unknown }>>(
      cursor
        ? Prisma.sql`
            SELECT id, answer
            FROM "AssessmentResponse"
            WHERE "answerCiphertext" IS NULL
              AND "skipped" = false
              AND id > ${cursor}
            ORDER BY id ASC
            LIMIT ${opts.batchSize}
          `
        : Prisma.sql`
            SELECT id, answer
            FROM "AssessmentResponse"
            WHERE "answerCiphertext" IS NULL
              AND "skipped" = false
            ORDER BY id ASC
            LIMIT ${opts.batchSize}
          `
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      processed++;
      const ciphertext = encryptAnswer(row.answer);
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "AssessmentResponse"
          SET "answerCiphertext" = ${ciphertext}
          WHERE id = ${row.id}
        `
      );
      updated++;
    }

    cursor = rows[rows.length - 1].id;
    console.log(
      `[backfill-encrypt-response-content] AssessmentResponse progress: processed=${processed} updated=${updated}`
    );
    if (rows.length < opts.batchSize) break;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `[backfill-encrypt-response-content] starting — batchSize=${opts.batchSize} dry=${opts.dryRun}`
  );

  await assertMigrationApplied();
  await backfillIntakeResponses(opts);
  await backfillAssessmentResponses(opts);

  console.log("[backfill-encrypt-response-content] done");
}

main()
  .catch((err) => {
    console.error("[backfill-encrypt-response-content] failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (
      typeof msg === "string" &&
      (msg.includes("answerCiphertext") || msg.includes("hasTranscription") || msg.includes("42703")) &&
      msg.includes("does not exist")
    ) {
      console.error(
        "[backfill-encrypt-response-content] hint: run migrations against this DATABASE_URL (npx prisma migrate deploy), then retry."
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaScript();
  });
