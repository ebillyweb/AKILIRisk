# BRD §5.1 amendment — round 11 (PII scope: MVP minimization by omission)

> **Header note for the maintainer:** this file is the canonical text for
> the next §5.1 revision. Paste into the Drive BRD when convenient; the
> repo copy is the source of truth until that's done. The strategy is
> "don't store it" rather than "encrypt everything" — most client PII
> categories are dropped from the schema entirely, leaving a small
> encrypted core (email, intake content) plus pseudonymous demographic
> fields on household members.

---

## §5.1 Personally Identifiable Information (revised)

### Scope of this section

"Personally identifiable information" (PII) in §5.1 refers to **client
data only** — the data of households who use Akili Risk to assess and
manage their risk profile. Client data is identified by:

- `User` rows where `role = USER`
- All rows transitively owned by such a `User` row: `ClientProfile`,
  `HouseholdMember`, `IntakeInterview`, `IntakeResponse` (including
  audio blobs and transcripts), `Assessment`, `AssessmentResponse`,
  `PillarScore`, `AssessmentRecommendation`, `DocumentRequirement`
  (client side), `NotificationPreference`, and any S3 blob keyed by a
  client's id.

Data belonging to **advisors** (firms and individual advisors using the
platform commercially) and **Akili Risk staff** (admins) is NOT covered
by §5.1. Those are commercial-counterparty and employee records,
respectively, and are governed by separate contractual terms (the
advisor MSA; staff employment agreements). Advisor PII is encrypted at
rest using the same toolkit but is otherwise out of §5.1's scope.

### Strategy: minimization by omission

The original §5.1 commitment was "no PII is stored." Reaching it
literally proved infeasible (every assessment platform needs at least
an email to address its users). The MVP-tightened compromise is to
store the absolute minimum necessary, drop everything else, and
encrypt what remains.

The rules below are enforced at the schema level (columns the platform
*could* store but won't) rather than only at the application level.
Removing a column from the schema is a stronger guarantee than
"promise not to write to it."

### What client PII is stored

The MVP stores the following — and only the following — client PII:

**1. Email (single field).** Required for the magic-link auth flow
(see §5.1.AUTH below) and for advisor-initiated notifications. Stored
encrypted at rest using deterministic AES-256-GCM (the deterministic
mode preserves the unique-constraint and equality-lookup behavior that
auth requires). No other identity fields — no first name, no last
name, no display name, no profile image, no date of birth.

**2. Household demographic data, pseudonymous form.** Each
`HouseholdMember` row stores only:
- `sex` (enum: MALE / FEMALE / OTHER / UNKNOWN)
- `birthYear` (Int, e.g. 1968 — not a full date of birth)
- `relationship` (enum: SPOUSE / CHILD / PARENT / DEPENDENT / OTHER)
- `governanceRoles` (enum array, the assessment-essential roles)
- `isResident` (Boolean)
- `shareWithAdvisor` (Boolean — control flag)

The household member's name, age (exact), occupation, phone, email,
and free-form notes are NOT stored. The advisor sees the household
composition by structure (sex × birthYear × relationship × roles)
without identifying any individual.

**3. Intake content, encrypted at rest.** The intake interview is
inherently free-form — clients describe their household, governance
practices, and concerns in their own words. Two columns hold this:
- `IntakeResponse.transcription` (String) — text transcription of the
  audio response, encrypted at rest with random-IV AES-256-GCM.
- `IntakeResponse.audioS3Key` (String) — reference to the audio blob
  in S3. The blob itself is the PII; the key is just a path. S3 server-
  side encryption is enabled on the bucket (SSE-KMS preferred,
  SSE-S3 acceptable as a fallback).

**4. Assessment free-form answers, encrypted at rest.** The
`AssessmentResponse.answer` column (Json) may contain narrative text
in addition to scored multiple-choice values. Encrypted at rest with
random-IV AES-256-GCM. The structured-answer subset is functionally
unaffected (decryption happens at the repository boundary).

**5. Auth artifacts.** The `User.password` and `User.mfaSecret`
columns physically exist on the table because advisors and admins use
them, but for `role = USER` rows they MUST be null. Application-layer
enforcement: the credentials provider rejects `role = USER` callers,
and the magic-link flow never writes to either column. The MFA secret
column for advisors is already encrypted at rest (round 1).

### What client PII is NOT stored (dropped from schema)

In service of "minimization by omission," the following columns are
removed from the schema:

- `User.firstName`, `User.lastName`, `User.image`
- `ClientProfile` table in its current form is reduced to a stub or
  removed entirely (decision tied to whether any non-PII fields
  remain product-essential)
- `HouseholdMember.fullName`, `age`, `occupation`, `phone`, `email`,
  `notes`
- `InviteCode.clientName`, `personalMessage`

Display sites that previously rendered these fields fall back to
either the email (where identification is needed) or the structural
description (e.g. "spouse, born 1972" instead of "Jane Doe, age 53").

### §5.1.AUTH — Magic-link auth for clients

Clients DO NOT log in with passwords. The only authentication path
for `role = USER` is a magic link issued via advisor-initiated email:

1. The advisor invites the client (creates an `InviteCode` with the
   client's email).
2. The platform issues a single-use, 15-minute magic-link token,
   stored hashed in the database.
3. The client clicks the link in their email; the token is validated;
   a session is created; the client lands on their dashboard.
4. Subsequent sessions: the client requests a new link from the
   platform's "send me a sign-in link" page, OR the advisor re-issues
   one from the advisor portal.

This eliminates the most common client-side credential breach vectors
(password reuse, weak passwords, phishing of credentials) at the cost
of email-account-compromise becoming the equivalent of credential
compromise. The trade is acceptable for the MVP risk profile.

### Protections that apply to client PII

1. **Encryption at rest.** Email is encrypted with deterministic
   AES-256-GCM (HMAC-derived IV scoped per-column). Intake transcripts
   and assessment answers are encrypted with random-IV AES-256-GCM.
   Keys are sourced from the platform's secret store and rotatable
   per the documented procedure.

2. **S3 blob encryption.** The intake-audio bucket is configured for
   server-side encryption (SSE-KMS preferred for key rotation
   visibility; SSE-S3 acceptable). No blob ever transits the platform
   in unencrypted form on disk.

3. **Redaction in audit logs and exports.** The audit log
   infrastructure (round 7) hashes every email-shaped field and
   strips secret-shaped fields from `beforeData` / `afterData` /
   `metadata` before persistence. Household-member fields drop out
   automatically once the underlying columns are gone. The data-
   export bundle (round 10) ships RAW client PII because the bundle
   is the canonical fulfillment of the §5.3 portability commitment;
   audit-log exports remain redacted.

4. **Retention.** Client PII is retained only while the client account
   is active. Soft-deleted accounts (`User.deletedAt`) retain data
   pending a possible restore; hard-deleted accounts (RTBF, §5.1.RTBF
   below) trigger a cascading purge of all owned rows and referenced
   S3 blobs.

5. **Right to be Forgotten (RTBF).** Admin-initiated. A client (or
   their advisor on the client's behalf, escalating to admin)
   requests deletion of all the client's data. The platform purges
   the `User` row and every transitively-owned row, deletes
   referenced S3 blobs, and anonymizes audit-log entries that
   reference the deleted user (preserving the compliance timeline
   without preserving the user's identity). The purge is irreversible
   and is itself audit-logged. Self-service RTBF is a future
   enhancement, deferred from the MVP.

6. **Subject Access Request (SAR).** A client can request a download
   of their complete dataset, fulfilled per the §5.3 portability
   bundle (CSV + nested JSON). MVP path is admin-initiated; client
   self-service is a future enhancement.

7. **Minimization, ongoing.** Schema columns that store PII are
   reviewed periodically against actual product needs; unused columns
   are dropped. Adding any new client-PII column requires explicit
   sign-off and a §5.1 amendment.
