import { z } from "zod";
import { waiverAssessmentScopeSchema } from "@/lib/schemas/advisor";

const DEFAULT_FIRM_FALLBACK = "Your advisor";

/** US-1: standard copy when the advisor leaves the personal message blank. */
export function buildDefaultInvitationPersonalMessage(
  firmName?: string | null,
): string {
  const firm = firmName?.trim() || DEFAULT_FIRM_FALLBACK;
  return `${firm} is inviting you to complete your family's Risk Profile. This confidential process will help us identify areas of risk that require action plans to protect your wealth for the long term`;
}

/** @deprecated Use buildDefaultInvitationPersonalMessage(firmName) for advisor-specific copy. */
export const DEFAULT_INVITATION_PERSONAL_MESSAGE =
  buildDefaultInvitationPersonalMessage(null);

function emptyToUndefined(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s.length > 0 ? s : undefined;
}

export const createInvitationSchema = z.object({
  // Round-11 bug-hunt fix: normalize email casing — magic-link request
  // route looks up InviteCode.prefillEmail with a case-sensitive Postgres
  // `=` predicate, and User.email writes go through deterministic
  // ciphertext (also case-sensitive). Both must agree on normalization
  // or an invite created as "Bob@Example.com" won't match a magic-link
  // request submitted as "bob@example.com".
  clientEmail: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
    z.string().email("Valid email required")
  ),
  clientName: z.preprocess(
    emptyToUndefined,
    z.string().max(100, "Name too long").optional()
  ),
  personalMessage: z.preprocess(
    emptyToUndefined,
    z.string().max(2000, "Message too long").optional()
  ),
  intakeWaived: z.boolean().optional().default(false),
  includedPillars: z.array(z.string()).max(6).optional(),
  focusAreas: z.array(z.string()).max(6).optional(),
}).superRefine((data, ctx) => {
  if (!data.intakeWaived) return;

  const scope = waiverAssessmentScopeSchema.safeParse({
    includedPillars: data.includedPillars ?? [],
    focusAreas: data.focusAreas,
  });

  if (!scope.success) {
    for (const issue of scope.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: issue.path,
      });
    }
  }
});

export type CreateInvitationData = z.infer<typeof createInvitationSchema>;
