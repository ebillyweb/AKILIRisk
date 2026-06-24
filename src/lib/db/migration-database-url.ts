/**
 * Prisma Migrate needs a direct Postgres connection (no PgBouncer pooler).
 * Neon pooler URLs cause P1002 advisory-lock timeouts during `migrate deploy`.
 */
export function resolveMigrationDatabaseUrl(): string | undefined {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;

  const pooled = process.env.DATABASE_URL?.trim();
  if (!pooled) return undefined;

  if (pooled.includes("-pooler.")) {
    return pooled.replace("-pooler.", ".");
  }

  return pooled;
}
