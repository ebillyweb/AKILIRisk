/**
 * @deprecated Use `npm run seed:pillar-ddl` — AssessmentBankQuestion was removed.
 * This script delegates to the pillar DDL seed for backward-compatible npm scripts.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

console.warn(
  "seed:assessment-bank is deprecated. Running seed:pillar-ddl (pillar `questions` table).",
);

const result = spawnSync("npm", ["run", "seed:pillar-ddl"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
