# US-1 — Send a Client Invitation (Advisor)

**Related:** [US-1B — Branded client invitation](./US-1B-branded-client-invitation.md) (email visual co-branding when `brandingEnabled` is on)

## Story

As an advisor, I want to send a prospective client a personalized email invitation, so that they can create an account and begin their assessment.

## Acceptance criteria

- **Given** a valid client email and optional name, personal message, and intake-waived flag, **when** I submit the invitation, **then** a single-use invitation is created with a 7-day expiry and status `SENT`.
- **Given** I leave the personal message blank, **then** a standard default invitation message is used.
- **Given** I enter the client email in mixed case or with surrounding spaces, **then** it is normalized (trimmed and lower-cased) before it is stored.
- **Given** I set the intake-waived flag, **then** the invitation routes the client directly to the assessment instead of intake.

## Implementation notes

- UI: `/advisor/invitations` — `InviteClientForm`
- Server action: `sendInvitation` in `src/lib/actions/invitations.ts`
- Schema: `createInvitationSchema` in `src/lib/schemas/invitation.ts`
- Service: `createAdvisorInvitation` in `src/lib/invitations/service.ts`
