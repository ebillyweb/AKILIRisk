/**
 * Detect Prisma errors when the generated client is ahead of the deployed
 * database schema (common on Vercel Preview before `prisma migrate deploy`).
 */
export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  // P2007: data validation (e.g. enum value missing on DB, such as PROVISIONING)
  if (code === "P2022" || code === "P2021" || code === "P2007") return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("does not exist") ||
    message.includes("Unknown column") ||
    (message.includes("column") && message.includes("not available")) ||
    /invalid input value for enum/i.test(message)
  );
}

export const SCHEMA_DRIFT_USER_MESSAGE =
  "The database schema is behind this deployment. Apply pending Prisma migrations (npx prisma migrate deploy) against the Preview database.";
