import { z } from "zod";

export const createInvitationSchema = z.object({
  // Round-11 bug-hunt fix: normalize email casing — magic-link request
  // route looks up InviteCode.prefillEmail with a case-sensitive Postgres
  // `=` predicate, and User.email writes go through deterministic
  // ciphertext (also case-sensitive). Both must agree on normalization
  // or an invite created as "Bob@Example.com" won't match a magic-link
  // request submitted as "bob@example.com".
  clientEmail: z
    .string()
    .email("Valid email required")
    .transform((s) => s.trim().toLowerCase()),
  clientName: z.string().max(100).optional(),
  personalMessage: z
    .string()
    .max(2000, "Message too long")
    .optional()
    .default(
      "I'd like to invite you to complete a family governance assessment. This confidential process will help us identify areas where your family's wealth management governance can be strengthened."
    ),
  intakeWaived: z.boolean().optional().default(false),
});

export type CreateInvitationData = z.infer<typeof createInvitationSchema>;