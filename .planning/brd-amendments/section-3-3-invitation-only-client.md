# BRD §3.3 amendment — round 12 (invitation-only client model)

> **Header note for the maintainer:** this file is the canonical text
> for the next §3.3 revision. Paste into the Drive BRD when convenient;
> the repo copy is the source of truth until that's done. The MVP
> shipped invitation-only magic-link auth (round-11 session 1); the
> original §3.3 "Direct Client (Self-Service User)" framing no longer
> matches the implementation. The amendment below replaces §3.3 with
> the actual ship-state and notes that self-service signup is deferred
> to a Phase 3 / D2C revisit.

---

## §3.3 Client (Invited User) — revised

### Scope of this section

"Client" in §3.3 refers to **a household member, principal, or
designated representative** who uses Akili Risk to complete an intake,
take a risk assessment, and read the resulting report — always in the
context of an advisor relationship. The original framing of the
client as a "Direct Client (Self-Service User)" — landing on a public
sign-up page, creating an account with email + password, MFA-ing in,
and self-driving end-to-end without an advisor — is no longer
accurate as of round-11.

Two parallel client experiences existed during the MVP development
arc; only the second is in the shipped product:

- **Phase 1 (deprecated, retained code paths only).** Self-service
  signup with email + password + (optional) MFA, gated behind an
  invite-code field. This path was used by the development team for
  fixture creation and never marketed to real clients. Its UI lives
  at `/auth/signup` and remains exposed for backward compatibility
  with seeded fixtures, but no production onboarding flow points at
  it.
- **Phase 2 (shipped MVP, round-11).** Invitation-only magic-link
  auth. The client never sees a signup form, never sets a password,
  and never enrolls in MFA.

§3.3 below documents Phase 2 as the canonical flow.

### Onboarding sequence

1. **Advisor invites the client.** From `/advisor/invitations` the advisor
   creates an `InviteCode` row keyed on the client's email. The
   invite email contains a single-use magic-link (US-1). Email visual
   co-branding (logo, primary CTA color) follows `AdvisorProfile.brandingEnabled`
   and subscription entitlements (US-1B — see `docs/user-stories/US-1B-branded-client-invitation.md`).
   When branding is off, the email uses platform-default styling plus an
   AKILI attribution line; the advisor signature block is always included.
2. **Client clicks the link in their email.** The platform validates
   the InviteCode row, provisions a `User` row with `role = USER` and
   no password (`User.password = null` per the §5.1 amendment), and
   issues a 15-minute magic-link token bound to the new account. The
   client is signed in immediately on link consumption — no separate
   "log in" step.
3. **Subsequent sessions.** The client requests a new sign-in link
   from the platform's "send me a sign-in link" page (or the advisor
   re-issues one from `ClientAuthControls`). Each link is single-use
   and time-limited. There is no password-based path; there is no
   MFA second factor.
4. **Email-mismatch / typo handling.** If the advisor mistyped the
   client's email at invite time, the client never receives the
   magic link. The advisor reassigns the email through the
   `ClientAuthControls` widget on the per-client view; this writes
   `CLIENT_EMAIL_REASSIGN` to the audit log and re-issues a magic
   link to the corrected address. The original `User` row stays
   intact; only the `emailCiphertext` column changes.

### Authentication contract

For `role = USER` callers:

- **No password.** `User.password` is null. The credentials provider
  in `auth.config.ts` rejects `role = USER` callers with
  `non_client_role_blocked`. A future implementation that introduces
  client passwords (e.g., for D2C) would have to remove this gate
  and re-enable the credentials provider for clients.
- **No MFA.** `User.mfaEnabled` is false; `User.mfaSecret` is null.
  The MFA enrollment endpoints in `/api/auth/mfa/*` reject
  `role = USER` callers. The MFA columns physically exist on the
  `User` table because advisors and admins use them.
- **Magic link is the single auth surface.** `MagicLinkToken` rows
  hold hashed tokens, expire 15 minutes after issuance, and are
  invalidated on consumption. `/api/cron/magic-link-prune` sweeps
  used + 7-day-expired rows nightly.
- **Email is the single client identity column.** Encrypted at rest
  (deterministic AES-256-GCM, scoped per-column via
  `USER_EMAIL_FIELD_KEY`). Round-11 §5.1 dropped every other
  identity field (firstName / lastName / image, plus the entire
  `ClientProfile` PII surface).

### Self-service signup is out of scope for the MVP

The original §3.3 framing assumed a "Direct Client" who self-onboards
without an advisor. That mode is **explicitly out of scope** for the
MVP and is captured here as a deferred Phase 3 / D2C concern:

- A client cannot create their own account.
- A client cannot recover account access without advisor (or admin)
  intervention — the only recovery path is "advisor re-issues a
  magic link," which presumes advisor reachability.
- The platform has no marketing-site signup flow, no public
  pricing page for direct clients, no Stripe billing for direct
  clients (advisor billing covers the relationship).
- Account deletion (RTBF) is similarly advisor / admin -mediated; no
  self-service "Delete my account" surface exists.

Phase 3 / D2C may revisit any or all of the above. Until then, the
"§3.3 Direct Client (Self-Service User)" framing in the original BRD
is misleading and should be replaced with the §3.3 Client (Invited
User) framing above.

### Trade-off note: email-as-credential

The MVP's invitation-only model trades one well-known credential
breach class (password reuse + weak passwords + credential phishing)
for another (email-account compromise). A client whose email account
is compromised is functionally equivalent to a credentials-compromised
account in any other system. The trade is acceptable for the MVP risk
profile because:

- Advisor relationships are typically established via verified
  channels before the invite goes out — the email is known and
  trusted at invite time.
- Client volumes are small enough that an out-of-band compromise
  notification path (advisor reaches out via phone / in-person)
  remains viable.
- The data exposure surface is bounded by §5.1 minimization — a
  compromised client account exposes the client's own intake +
  assessment + reports, not a roster of others.

If client volumes scale or if a D2C path opens, this trade-off
should be re-evaluated. A second factor on the magic-link consumption
step (e.g. SMS verification code) is the natural mitigation and would
be straightforward to add — the existing `MagicLinkToken` shape can
carry the additional state without schema change.

### What does NOT change with this amendment

- Advisor and admin authentication (password + MFA + role gate)
  remains exactly as documented in the original §3.3 advisor /
  admin sections.
- Round-11's §5.1 PII-scope amendment continues to apply: client
  email is the only stored identity column; intake content + audio
  + assessment answers remain encrypted at rest.
- The audit constants in `AUDIT_ACTIONS` cover the magic-link
  lifecycle (`AUTH_MAGIC_LINK_REQUEST` / `AUTH_MAGIC_LINK_SUCCESS`
  / `AUTH_MAGIC_LINK_FAILURE`) and the advisor-mediated email
  reassignment (`CLIENT_EMAIL_REASSIGN`,
  `CLIENT_MAGIC_LINK_REISSUE`); no new audit constants are needed
  for this amendment.

### Summary

The shipped MVP is invitation-only. §3.3 in the BRD should reflect
that. The "Self-Service User" framing has been replaced with
"Invited User" and explicitly marked as the canonical client model
for the MVP, with self-service signup deferred to Phase 3 / D2C.
