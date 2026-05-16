/**
 * Prisma client for Node/tsx scripts. Prisma 7 requires a driver adapter.
 * Loads `.env.local` from the repo root so DATABASE_URL is set like `next dev`.
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(repoRoot, ".env.local") });

function postgresUrlWithExplicitSslMode(url: string): string {
  return url.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/gi,
    "$1verify-full"
  );
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl?.trim()) {
  throw new Error(
    "DATABASE_URL is missing. Set it in .env.local (see .env.example)."
  );
}

const pool = new Pool({
  connectionString: postgresUrlWithExplicitSslMode(rawUrl),
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

export async function disconnectPrismaScript(): Promise<void> {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
}
