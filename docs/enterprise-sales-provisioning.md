# Enterprise sales provisioning runbook

Sales-assisted provisioning for **Enterprise firms** (multi-seat, firm-level billing). There is no self-serve enterprise signup; firms are created by platform admin after a contract is signed.

**Enterprise is a provisioning classification**, not a subscription module tier. Admin selects the **module tier** (Essentials → Platinum) at provision time; that value is stored on `Subscription.tier` and controls firm-wide feature entitlements for all team members.

## Prerequisites

- Sales quote agreed (defaults: **25 seats**, **100 firm clients**, **25 clients per advisor** unless negotiated).
- **Module tier** agreed (Essentials, Professional, Business, or Platinum).
- **Owner** is an existing Akili advisor user (`ADVISOR` role) with an `AdvisorProfile`.
- Owner has **no active solo Stripe subscription** at provision time — any solo row (including admin grace) is **cancelled automatically** when the firm is created.
- Owner is **not** already a member of another enterprise.

## Wire transfer (primary)

1. Sales closes the contract and sends firm name, desired subdomain slug, owner email, negotiated limits, and **module tier** to ops.
2. Admin signs in → **Admin → Enterprises → Provision enterprise**.
3. Fill the form:
   - **Firm name** — display name on billing and team UI.
   - **Subdomain slug** — lowercase, 3–20 chars; becomes `{slug}-staging.akilirisk.com` (staging) or `{slug}.akilirisk.com` (production).
   - **Owner** — select the advisor user who will manage billing and team.
   - **Module tier** — Essentials through Platinum (default: Professional).
   - **Billing cycle** — Monthly or Annual (default: Annual).
   - **Limits** — seat / firm client / per-advisor caps (defaults pre-filled).
   - **Payment method** — **Wire transfer (offline)**.
4. Submit. The system creates:
   - `AdvisorEnterprise` + `EnterpriseMembership` (OWNER, ACTIVE)
   - Firm `Subscription` with `tier = <module tier>`, `status = ACTIVE`, optional null Stripe IDs
   - Enterprise subdomain row linked to the firm slug
5. Finance confirms wire payment offline. No Stripe action required for wire firms.
6. Record wire reference in your finance tracker; optional: add notes via audit log follow-up.

## Credit card (secondary)

1. In Stripe Dashboard (or internal script), create **Customer** and **Subscription** for the quoted module tier price × seat count.
2. Set subscription metadata:

   ```json
   {
     "enterpriseId": "<filled after admin create, or update after>",
     "tier": "PROFESSIONAL",
     "billing_cycle": "MONTHLY|ANNUAL"
   }
   ```

   `tier` must be a **module tier** (`ESSENTIALS`, `PROFESSIONAL`, `BUSINESS`, or `PLATINUM`), not `ENTERPRISE`.

3. Admin → **Provision enterprise** with **Payment method = Credit card (Stripe)** and paste `stripeCustomerId` / `stripeSubscriptionId` when available.
4. If Stripe IDs are omitted at provision, the firm owner completes checkout at `/advisor/enterprise/pricing` for the **admin-selected module tier** (contract-locked).
5. Webhooks sync subscription status via existing enterprise webhook routing (`enterpriseId` on the `Subscription` row).
6. Firm **owner** can open **Manage billing & receipts** on `/advisor/billing` (Stripe Customer Portal). ADMIN and ADVISOR roles cannot.

## Post-provisioning checklist

- [ ] Owner can sign in and access Advisor Hub with correct module-tier gates.
- [ ] Admin firm detail shows expected **module tier**; update via **Module subscription** panel if sales corrects the contract.
- [ ] `/advisor/settings/team` shows seat usage; overage badge appears when `activeSeats > seatLimit` (report-only in v1).
- [ ] `/advisor/billing` (owner/admin only) shows firm client usage, per-advisor cap policy, seats, payment method, and module tier.
- [ ] Client-facing branding resolves from the enterprise record.
- [ ] Subdomain resolves for verified enterprise slug.

## Seat overage

When active team members exceed `seatLimit`, the admin enterprise list and owner billing/team UI show overage. **v1 does not block invites or hub access** — ops uses the admin **Seat overage** column for reporting.

## Solo subscription on enterprise join

When an advisor becomes an enterprise **owner** (admin provision) or **accepts a team invite**, their solo `Subscription` row is set to `CANCELLED` and any linked Stripe solo subscription is cancelled (best effort). Hub access then comes from the firm subscription via `resolveBillingContext`.

There is no dual billing and no manual pre-cancel step for grace-period or wire-only solo accounts. Solo client assignments stay on the advisor profile; billing context switches to the firm.

## Environment

| Variable | Purpose |
|----------|---------|
| `ENTERPRISE_SALES_EMAIL` | Mailto target for solo “Contact sales” on `/advisor/billing` (default `sales@akilirisk.com`) |
| `ENABLE_BILLING_FEATURES` | Set to `false` to disable billing UI globally |

## Admin paths

- List firms: `/admin/enterprises`
- Manage firm (module tier, suspend / reactivate / delete): `/admin/enterprises/{enterpriseId}`
- Provision: `/admin/enterprises/new`
- Server actions: `createEnterpriseByAdmin`, `updateEnterpriseModuleTierByAdmin`, `suspendEnterpriseByAdmin`, `reactivateEnterpriseByAdmin`, `deleteEnterpriseByAdmin` in `src/lib/admin/actions.ts`

## Suspend firm (reversible)

Use when a contract pauses or billing stops — **does not delete data**.

1. Admin → **Enterprises** → **Manage** on the firm.
2. Click **Suspend firm** and confirm.
3. Effects:
   - Firm `status` → `SUSPENDED`
   - Firm subscription → `CANCELLED` (Stripe sub cancelled when present)
   - Tenant subdomain deactivated
   - All member sessions cleared — hub access blocked until reactivation
4. To restore: **Reactivate firm** on the same page (subscription set back to `ACTIVE` with a renewed period end).

## Delete firm (permanent)

Use when deprovisioning a firm entirely.

1. Admin → **Enterprises** → **Manage**.
2. Type the firm **slug** exactly and click **Delete firm permanently**.
3. Effects:
   - Enterprise row, memberships, and firm subscription removed (DB cascade)
   - Advisor profiles unlinked (`enterpriseId` cleared) — users remain `ADVISOR` accounts
   - Slug becomes available for a new firm
   - Stripe subscription cancelled when present
4. **Does not** delete clients, intake, or advisor user accounts.

## Troubleshooting

| Issue | Action |
|-------|--------|
| “Owner must cancel their personal subscription” | Legacy — solo subs are now auto-cancelled on provision. Retry the form. |
| “Owner already belongs to an enterprise” | Transfer ownership or use a different owner account. |
| Slug reserved / taken | Choose another slug; check platform reserved labels in `docs/white-label-subdomains.md`. |
| Wire firm shows no invoices on billing page | Expected — wire firms have no Stripe customer; invoices are offline. |
| Portal button missing for card firm | Owner role required; `paymentMethod` must be `CARD` with `stripeCustomerId` set. |
| Owner sees wrong feature gates | Check **Module tier** on admin firm detail; update via **Module subscription** panel. |
