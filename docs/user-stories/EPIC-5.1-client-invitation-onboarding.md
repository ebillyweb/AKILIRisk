# Epic 5.1 — Client Invitation & Onboarding

**BRD:** §5.1 (FR-1, FR-11; business rules §3.4, §3.6)  
**Advisor UI:** `/advisor/invitations`  
**Core modules:** `src/lib/invitations/*`, `src/lib/actions/invitations.ts`, `src/lib/billing/subscription-service.ts`, `src/lib/auth/magic-link.ts`, `src/app/(auth)/signup/page.tsx`

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-1 | Send invitation | **Done** | [US-1](./US-1-send-client-invitation.md) |
| US-2 | Subscription client limit | **Done** | `assertCanAddClientForAdvisorProfile` before create |
| US-3 | Branded invitation email | **Done** | US-1B + `sendInvitationEmail` / enhanced template |
| US-4 | Recover from failed email | **Done** | Shareable link on failed send and resend |
| US-5 | Track invitation opened | **Done** | `markInvitationOpened` + `/api/invitations/:id/opened` from signup |
| US-6 | Magic-link account creation | **Done** | 15‑min tokens; signup auto-sign-in; password register 410 |
| US-7 | Provision & link to advisor | **Done** | Idempotent; email/role guards |
| US-8 | Resend invitation | **Done** | 3-resend cap; no resend on `EXPIRED` / `REGISTERED` |
| US-9 | Expire & review invitations | **Done** | Status filter + search on `/advisor/invitations` |

---

## US-1 — Send a Client Invitation (Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Single-use invite, 7-day expiry, `SENT` | `createAdvisorInvitation` — `maxUses: 1`, `INVITATION_TTL_SEC`, `InvitationStatus.SENT` |
| Default personal message when blank | `createInvitationSchema` → `DEFAULT_INVITATION_PERSONAL_MESSAGE` |
| Email trim + lowercase | `z.preprocess` on `clientEmail` in `src/lib/schemas/invitation.ts` |
| Intake-waived → assessment | `buildInvitationSignupUrl` callback `/assessment` vs `/intake` |

**Docs:** [US-1-send-client-invitation.md](./US-1-send-client-invitation.md)

---

## US-2 — Enforce Subscription Client Limit at Invite Time (System)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| At client cap → reject with count/limit | `ClientLimitError` from `assertCanAddClientForAdvisorProfile` in `sendInvitation` |
| No active subscription → billing message | Same helper; non-cap message: subscription not active |
| Rejected → no invitation row | Assert runs **before** `createAdvisorInvitation` |

**Code:** `src/lib/billing/subscription-service.ts`, `src/lib/actions/invitations.ts` (`sendInvitation`)

---

## US-3 — Deliver the Branded Invitation Email (System)

**Status: Done** (see also [US-1B](./US-1B-branded-client-invitation.md) for white-label link + enhanced header)

| Criterion | Implementation |
|-----------|----------------|
| Logo, firm, title, contact, message, CTA, 7-day notice | `sendInvitationEmail` → enhanced template when `brandingEnabled`, else `email.ts` |
| Greet by name when known | `Dear {clientName}` / enhanced template |
| Link → intake or assessment when waived | `invitation-link.ts` + signup `callbackUrl` |
| Neutral greeting when no name | `Hello,` in simple and enhanced templates |

**Code:** `src/lib/invitations/send-invitation-email.ts`, `enhanced-email.ts`, `email.ts`

---

## US-4 — Recover from a Failed Email Send (Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Email fails / Resend missing → invite still created + link returned | `sendInvitation` / `resendInvitationAction`; `ShareableInvitationLinkAlert` on send and resend |
| Delivery outcome in audit | `INVITE_SEND` / `INVITE_RESEND` metadata: `emailSent`, `emailNotSentReason` |

---

## US-5 — Track When an Invitation Is Opened (Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| `SENT` → `OPENED` when opened | `markInvitationOpened`; `SignupInviteProcessor` POSTs `/api/invitations/:id/opened` before signup completes |
| `REGISTERED` not downgraded | `updateMany` only when `status: SENT`; provision sets `REGISTERED` without downgrade |

**Code:** `src/lib/invitations/mark-opened.ts`, `src/components/auth/SignupInviteProcessor.tsx`

---

## US-6 — Create an Account from an Invitation via Magic Link (Client)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Sign-in link, 15 minutes, single-use | `DEFAULT_MAGIC_LINK_TTL_MS`; `issueMagicLinkToken` / `consumeMagicLinkToken` |
| Valid link → account + signed in | `/signup` → `acceptInvitationFromToken` → `signIn("magic-link")` |
| Expired / used / invalid → clear message | `InviteAcceptFailure`, magic-link verify + `validateMagicLinkToken` |
| Password registration unavailable | `POST /api/auth/register` → **410 Gone** |
| Request link for invited email (no password) | `POST /api/auth/magic-link/request` matches active `InviteCode` |

**Code:** `src/lib/auth/magic-link.ts`, `src/app/(auth)/signup/page.tsx`, `src/app/auth/magic-link/verify/page.tsx`

---

## US-7 — Provision the Client and Link Them to the Advisor (System)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| First redemption → `USER`, `ClientProfile`, `ClientAdvisorAssignment`, `REGISTERED` | `provisionClientFromInviteCode` transaction |
| Repeat redemption idempotent | Existing user path; no duplicate assignment |
| Email ≠ invite target → refused | `inviteEmail !== normalizedEmail` → `not_found` |
| Advisor/admin email → refused | `existing.role !== "USER"` → `blocked` |

**Tests:** `src/lib/invitations/provision-client.test.ts`

---

## US-8 — Resend an Invitation (Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| &lt; 3 resends → new 7-day expiry, `SENT`, new email | `resendInvitation` + `resendInvitationAction` |
| 3 resends → no resend | `resendCount >= 3`; `invitationCanResend` |
| Not owner → cannot resend | `createdBy !== advisorId` |
| Manually expired → cannot resend | Service + UI block `EXPIRED` and `REGISTERED` |

---

## US-9 — Expire and Review Invitations (Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Expire → `EXPIRED`, not redeemable | `expireInvitation` sets status + `expiresAt: now`; provision checks expiry |
| List only own invites | `getAdvisorInvitations` `where: { createdBy: advisorId }` |
| Filter by status / search email or name | `InvitationListFilters` + `searchParams` on `/advisor/invitations` |
| Audit on send / resend / expire | `INVITE_SEND`, `INVITE_RESEND`, `INVITE_EXPIRE` |

---

## Related docs

- [US-1 — Send a Client Invitation](./US-1-send-client-invitation.md)
- [US-1B — Branded client invitation](./US-1B-branded-client-invitation.md)
