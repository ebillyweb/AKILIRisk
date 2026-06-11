import { z } from "zod";
import { waiverAssessmentScopeSchema } from "@/lib/schemas/advisor";

/** US-1: standard copy when the advisor leaves the personal message blank. */
export const DEFAULT_INVITATION_PERSONAL_MESSAGE =
  "I'd like to invite you to complete a family governance assessment. This confidential process will help us identify areas where your family's wealth management governance can be strengthened.";

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
    z
      .string()
      .max(2000, "Message too long")
      .optional()
      .default(DEFAULT_INVITATION_PERSONAL_MESSAGE)
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
