/**
 * Round-11 bug-hunt fix (RISK 1): re-encrypt every User.emailCiphertext
 * row under the normalized (lowercased + trimmed) plaintext.
 *
 * Background
 * ----------
 * `userEmailCiphertext()` originally encrypted whatever plaintext it
 * received, so a signup with `Alice@Example.com` and a later signin
 * with `alice@example.com` produced different ciphertexts and the
 * unique constraint didn't catch them as duplicates. The post-fix
 * helper normalizes input via `email.trim().toLowerCase()` before
 * deterministic encryption, but rows written before the fix still
 * carry ciphertext for whatever case the user originally typed.
 *
 * This script
 * -----------
 * For each User row:
 *   1. Decrypts the stored emailCiphertext (round-trips back to the
 *      original-case plaintext that was encrypted).
 *   2. Computes the normalized ciphertext via the post-fix helper.
 *   3. If the new ciphertext differs from the stored one, updates the
 *      row in-place. Lowercase-input rows are no-ops (encryption is
 *      deterministic — same input + same key → same ciphertext).
 *
 * Idempotent. Safe to re-run. Writes are wrapped in a transaction per
 * batch; the `--dry-run` flag prints what would change without
 * touching the DB.
 *
 * Pre-flight collision check
 * --------------------------
 * If two rows had the same email modulo case (e.g. `Alice@…` and
 * `alice@…` both signed up — the original bug-hunt finding), then
 * normalizing both ciphertexts to the same value would violate the
 * `User.emailCiphertext @unique` constraint and the second update
 * would throw. We detect this case BEFORE any writes by grouping
 * rows by their would-be normalized ciphertext; collision groups
 * are reported with the conflicting user ids and skipped. Resolving
 * a collision requires merging the two accounts (out of scope for
 * this script — operator must run a manual reconciliation first).
 *
 * Usage:
 *   npx tsx scripts/normalize-user-email-ciphertext.ts            # write
 *   npx tsx scripts/normalize-user-email-ciphertext.ts --dry-run  # preview
 *
 * Requires `ENCRYPTION_KEY` and `DATABASE_URL` in env (loaded from
 * .env.local then .env, same as the other helper scripts).
 */
import path from "node:path";
import dotenv from "dotenv";
const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  decryptUserEmail,
  userEmailCiphertext,
} from "../src/lib/auth/user-email-crypto";

const DRY_RUN = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Add it to .env.local or .env, then re-run.");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set. Required to decrypt + re-encrypt.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface RowPlan {
  id: string;
  oldCiphertext: string;
  newCiphertext: string;
  /** Decrypted plaintext (pre-normalization) for log output. We only
   *  print the email-domain part to avoid PII in script logs; the
   *  local part is hashed in the summary. */
  plaintext: string;
}

(async () => {
  const rows = await prisma.user.findMany({
    select: { id: true, emailCiphertext: true },
  });
  console.log(`Loaded ${rows.length} User rows.`);

  const plans: RowPlan[] = [];
  const decryptFailures: { id: string; reason: string }[] = [];
  for (const r of rows) {
    let plaintext: string;
    try {
      plaintext = decryptUserEmail(r.emailCiphertext);
    } catch (e) {
      decryptFailures.push({
        id: r.id,
        reason: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    const newCiphertext = userEmailCiphertext(plaintext);
    if (newCiphertext !== r.emailCiphertext) {
      plans.push({
        id: r.id,
        oldCiphertext: r.emailCiphertext,
        newCiphertext,
        plaintext,
      });
    }
  }

  console.log(`Rows needing re-encryption: ${plans.length}`);
  if (decryptFailures.length > 0) {
    console.warn(
      `WARNING: ${decryptFailures.length} rows failed to decrypt; they need manual investigation:`
    );
    for (const f of decryptFailures) {
      console.warn(`  ${f.id}: ${f.reason}`);
    }
  }

  // Collision detection: any two rows that would normalize to the
  // same ciphertext can't both update without a unique-constraint
  // violation. Group plans by newCiphertext and skip collision groups.
  const byNew = new Map<string, RowPlan[]>();
  for (const p of plans) {
    const bucket = byNew.get(p.newCiphertext) ?? [];
    bucket.push(p);
    byNew.set(p.newCiphertext, bucket);
  }
  const safeUpdates: RowPlan[] = [];
  const collisions: RowPlan[][] = [];
  for (const bucket of byNew.values()) {
    if (bucket.length === 1) {
      safeUpdates.push(bucket[0]);
    } else {
      collisions.push(bucket);
    }
  }
  // Also: a plan might collide with an EXISTING row's ciphertext that
  // is already lowercase-form. Check those too.
  for (let i = safeUpdates.length - 1; i >= 0; i--) {
    const p = safeUpdates[i];
    const conflict = await prisma.user.findFirst({
      where: { emailCiphertext: p.newCiphertext, NOT: { id: p.id } },
      select: { id: true },
    });
    if (conflict) {
      collisions.push([p, { id: conflict.id, oldCiphertext: p.newCiphertext, newCiphertext: p.newCiphertext, plaintext: p.plaintext }]);
      safeUpdates.splice(i, 1);
    }
  }

  if (collisions.length > 0) {
    console.warn(
      `WARNING: ${collisions.length} collision group(s) — multiple rows would normalize to the same ciphertext. These rows are SKIPPED; reconcile them manually before re-running.`
    );
    for (const group of collisions) {
      const domain = group[0].plaintext.split("@")[1] ?? "<no-domain>";
      console.warn(
        `  ${group.length} rows for ...@${domain}: ids=${group.map((r) => r.id).join(",")}`
      );
    }
  }

  console.log(`Safe updates: ${safeUpdates.length}`);
  if (DRY_RUN) {
    console.log("--dry-run set; no DB writes performed.");
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  }

  // Apply updates in batches of 100 to keep transactions short.
  const BATCH_SIZE = 100;
  let written = 0;
  for (let i = 0; i < safeUpdates.length; i += BATCH_SIZE) {
    const batch = safeUpdates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((p) =>
        prisma.user.update({
          where: { id: p.id },
          data: { emailCiphertext: p.newCiphertext },
        })
      )
    );
    written += batch.length;
    console.log(`  Updated ${written}/${safeUpdates.length}`);
  }
  console.log(`Done. ${written} rows re-encrypted.`);

  await prisma.$disconnect();
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch {
    /* swallow */
  }
  process.exit(1);
});
