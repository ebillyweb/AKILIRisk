---
phase: 23
slug: client-engagement-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (globals enabled) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | LIFECYCLE-02a | T-23-01 | Server action checks session role before allowing MilestoneStatus changes | unit | `npx vitest run src/lib/recommendations/solution-lifecycle.test.ts -t "BLOCKED"` | Extend existing | pending |
| 23-01-02 | 01 | 1 | LIFECYCLE-02b | -- | Auto-completion when all milestones terminal | unit | `npx vitest run src/lib/recommendations/solution-lifecycle.test.ts -t "auto-complete"` | Extend existing | pending |
| 23-01-03 | 01 | 1 | LIFECYCLE-02c | -- | Auto-completion blocked by BLOCKED milestone | unit | Same file | Extend existing | pending |
| 23-02-01 | 02 | 1 | LIFECYCLE-02d | T-23-02 | Activity feed query returns client-scoped results only | unit | `npx vitest run src/lib/engagement/activity-feed.test.ts` | Wave 0 | pending |
| 23-02-02 | 02 | 1 | LIFECYCLE-02e | T-23-03 | Feature flag gates tracking UI server-side | unit | `npx vitest run src/lib/engagement/feature-flags.test.ts` | Wave 0 | pending |
| 23-03-01 | 03 | 2 | LIFECYCLE-02f | -- | Engagement metrics aggregation returns correct counts | unit | `npx vitest run src/lib/engagement/engagement-metrics.test.ts` | Wave 0 | pending |
| 23-03-02 | 03 | 2 | LIFECYCLE-02g | -- | Publish action plan server action sets publishedAt | unit | `npx vitest run src/lib/actions/engagement-actions.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engagement/activity-feed.test.ts` -- activity feed query tests
- [ ] `src/lib/engagement/feature-flags.test.ts` -- feature flag check tests
- [ ] `src/lib/engagement/engagement-metrics.test.ts` -- metrics aggregation tests
- [ ] `src/lib/actions/engagement-actions.test.ts` -- server action tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero-noise: advisor without published action plan sees no tracking UI | LIFECYCLE-02 D-01/D-06 | Requires visual browser check | Sign in as advisor2@test.com (no clients with published plans), verify no activity feed or engagement columns visible |
| Activity feed collapsible section renders with date grouping | LIFECYCLE-02 D-04 | Visual layout verification | Sign in as client with published action plan, check Recent Activity section groups by date |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
