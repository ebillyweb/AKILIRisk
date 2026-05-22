# US-1B — Branded client invitation (advisor branding enabled)

**Parent / related:** [US-1 — Send a Client Invitation (Advisor)](./US-1-send-client-invitation.md)  
**BRD:** §3.3 Client (Invited User); Phase 015 INVITE-02, BRAND-01/02  
**Implementation:** `src/lib/invitations/invitation-email-theme.ts`, `src/lib/invitations/email.ts`, `src/lib/invitations/enhanced-email.ts`, `src/lib/invitations/invitation-link.ts`, `src/lib/invitations/send-invitation-email.ts`, `src/lib/actions/invitations.ts`, `src/proxy.ts`, `src/lib/client/tenant-portal-branding.ts`

## Story

As an advisor with branding turned on, I want invitation emails to reflect my firm’s logo and colors, so that the client’s first touchpoint matches the branded experience they will see in the portal.

As an advisor with branding turned off, I want invitation emails to use the platform’s neutral presentation, so that clients are not shown advisor visual assets the advisor has deliberately disabled.

As an advisor with a verified custom subdomain, I want invitation links to use my white-label host, so clients stay on my branded domain through signup and intake.

## Acceptance criteria

### Branding enabled

- **Given** `AdvisorProfile.brandingEnabled = true` and a valid HTTPS `logoUrl`, **when** I send an invitation (US-1), **then** the email includes my logo in the header (and footer when a logo is shown).
- **Given** `brandingEnabled = true` and my subscription includes advanced branding (`advancedBrandingEnabled`) with a valid primary color configured, **when** I send an invitation, **then** the “Get Started” button and message accent use my primary brand color.
- **Given** `brandingEnabled = true` and a configured `tagline`, **when** I send an invitation, **then** the email uses the enhanced template header with the tagline under the firm name.
- **Given** `brandingEnabled = true`, **when** I send an invitation, **then** the email still includes my personal message and advisor signature block (name, firm, contact, license) from US-1.

### White-label invite link

- **Given** `brandingEnabled = true`, `customDomainEnabled = true`, subscription `customSubdomainEnabled`, and an active DNS-verified advisor subdomain, **when** I send an invitation, **then** the signup URL uses `https://{subdomain}.{platform-domain}/signup?invite=…` (not the main app host).
- **Given** subdomain prerequisites are not met, **when** I send an invitation, **then** the signup URL falls back to the platform `NEXTAUTH_URL` / public app origin.

### Branding disabled

- **Given** `brandingEnabled = false`, **when** I send an invitation, **then** the email does **not** include my logo or custom brand colors, even if `logoUrl` or colors remain on my profile.
- **Given** `brandingEnabled = false`, **when** I send an invitation, **then** the email uses platform-default styling for the call-to-action and includes a short platform attribution line so the client knows the message was sent via AKILI Risk Intelligence on my behalf.

### Client portal on tenant host

- **Given** a client opens an invite on the advisor subdomain and completes signup, **when** they reach protected client routes (`/intake`, `/dashboard`, etc.) on that host, **then** the client portal uses advisor branding (assignment branding, or tenant headers when assignment branding is not yet available).
- **Given** a verified tenant subdomain, **when** a client visits `/signup` or other journey paths on that host, **then** the proxy forwards to the main app routes with tenant context headers (no 404 from missing `/branded/*` stubs).

### Cross-cutting

- **Given** I resend an existing invitation, **then** the same branding and link rules apply based on my **current** profile, subdomain, and subscription at resend time.
- **Given** US-1 creates the invitation row and link, **then** US-1B governs **email presentation** and **public signup URL origin**; intake-waived routing and invite expiry are unchanged.

## Test coverage

- `src/lib/invitations/invitation-email-theme.test.ts` — theme resolution from profile + subscription features.
- `src/lib/invitations/email.test.ts` — rendered HTML omits logo when branding disabled; applies primary CTA when enabled.
- `src/lib/invitations/invitation-link.test.ts` — subdomain origin vs platform fallback; signup URL shape.
- `src/lib/invitations/service.test.ts` — invitation row + URL callback paths (with mocked link resolver).
