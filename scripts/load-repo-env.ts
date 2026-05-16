/**
 * Load `.env.local` from the repository root (import this before Prisma in any `scripts/*.ts`).
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(repoRoot, ".env.local") });
