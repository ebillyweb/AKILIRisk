/**
 * Load env before any `@/lib/db` import. Next.js loads .env.local automatically;
 * bare `tsx` scripts do not.
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(repoRoot, ".env.local") });

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error(
    "DATABASE_URL is missing. Add it to .env.local (see .env.example). " +
      "Scripts run with `tsx` do not load env the way `next dev` does."
  );
}
