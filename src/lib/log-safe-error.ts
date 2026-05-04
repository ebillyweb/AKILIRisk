import { Prisma } from "@prisma/client";

/**
 * Log an error without leaking user-supplied values.
 *
 * Round-6 finding: bare `console.error("X:", error)` calls in API routes
 * leak PII when the error is a Prisma `PrismaClientKnownRequestError`. For
 * `P2002` (unique constraint violation) the `meta.target` field includes
 * the conflicting *value*, not just the column name — so a registration
 * collision logs the colliding email address into application logs.
 *
 * This helper detects Prisma known-request errors and logs only the safe
 * fields (`code`, the *keys* of `meta`, but never the values). For other
 * errors it falls back to `error.message` (no `error.stack`, since stacks
 * can also include user-supplied values when constructed from string
 * interpolation).
 *
 * Pass a `scope` string so the log line is greppable.
 */
export function logSafeError(scope: string, error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const metaKeys = error.meta ? Object.keys(error.meta) : [];
    console.error(`[${scope}] PrismaClientKnownRequestError`, {
      code: error.code,
      metaKeys,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Validation error messages can contain field values when Prisma
    // includes them in its complaint text. Log only the constructor name.
    console.error(`[${scope}] PrismaClientValidationError`);
    return;
  }

  if (error instanceof Error) {
    console.error(`[${scope}]`, error.message);
    return;
  }

  console.error(`[${scope}]`, "Unknown error");
}

/**
 * Return a safe user-facing error message.
 *
 * Use in catch blocks that bubble `error.message` to the UI: Prisma error
 * messages can include user-supplied values (e.g. P2002's text contains
 * the colliding field value). This helper substitutes `fallback` for any
 * Prisma error and otherwise passes through `Error.message`.
 *
 * Pair with `logSafeError` so logs and user-facing copy both stay clean.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return fallback;
  if (error instanceof Prisma.PrismaClientValidationError) return fallback;
  if (error instanceof Error) return error.message;
  return fallback;
}
