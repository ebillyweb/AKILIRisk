/**
 * Detect Prisma errors when the generated client is ahead of the deployed
 * database schema (common on Vercel Preview before `prisma migrate deploy`).
 */
export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "P2022" || code === "P2021") return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("does not exist") ||
    message.includes("Unknown column") ||
    message.includes("column") && message.includes("not available")
  );
}
