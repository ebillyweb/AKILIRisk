import { z } from "zod";

/**
 * Postgres `@db.Uuid` — accepts any 128-bit UUID string, including seed DDL
 * ids that are not RFC-4122 (e.g. `00000000-0000-0000-0002-000000000005`).
 * Prefer this over `z.string().uuid()` for pillar section/question ids.
 */
export const pillarDbUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

export function parsePillarDbUuid(value: unknown, label = "id"): string {
  const parsed = pillarDbUuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid ${label}.`);
  }
  return parsed.data;
}
