/**
 * Run a SQL file against DATABASE_URL to seed platform question bank tables:
 * intake bank + assessment question bank (`categories`, `sections`, `questions`).
 * Apply migrations first; the bundled SQL is INSERT-focused (schema lives in migrations).
 *
 * Default file: scripts/sql/belvedere-pillar-ddl-seed.sql
 * Override: PILLAR_DDL_SEED_PATH=/absolute/or/relative/to/repo/root/file.sql
 *
 * Usage: npm run seed:pillar-ddl
 */
import "./load-repo-env";
import { existsSync, readFileSync } from "fs";
import { isAbsolute, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_REL = "scripts/sql/belvedere-pillar-ddl-seed.sql";

function postgresUrlWithExplicitSslMode(url: string): string {
  return url.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/gi,
    "$1verify-full"
  );
}

function resolveSqlPath(): string {
  const configured = process.env.PILLAR_DDL_SEED_PATH?.trim();
  if (!configured) {
    return resolve(repoRoot, DEFAULT_REL);
  }
  if (isAbsolute(configured)) {
    return configured;
  }
  return resolve(repoRoot, configured);
}

async function main(): Promise<void> {
  const sqlPath = resolveSqlPath();
  if (!existsSync(sqlPath)) {
    console.error(
      `Pillar DDL seed file not found: ${sqlPath}\n` +
        `Create it or set PILLAR_DDL_SEED_PATH to your platform question bank .sql file.`
    );
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, "utf8");
  if (!sql.trim()) {
    console.error(`SQL file is empty: ${sqlPath}`);
    process.exit(1);
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl?.trim()) {
    throw new Error(
      "DATABASE_URL is missing. Set it in .env or .env.local (see .env.example)."
    );
  }

  const pool = new Pool({
    connectionString: postgresUrlWithExplicitSslMode(rawUrl),
  });

  const client = await pool.connect();
  try {
    await client.query(sql);
    const countRes = await client.query<{ c: string }>(
      "SELECT count(*)::text AS c FROM questions"
    );
    const n = countRes.rows[0]?.c ?? "?";
    console.log(`Executed pillar DDL seed: ${sqlPath}`);
    console.log(`public.questions row count: ${n}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
