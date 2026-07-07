---
phase: 23
plan: "05"
status: done
---

# Plan 05 Summary: Advisor Engagement Dashboard & Portfolio Integration

## What was built

- `/advisor/engagement` page with feature flag gating and Suspense loading
- EngagementMetricsCards (4 cards: completion %, active clients, stalled, overdue)
- EngagementDashboard server component with tabbed views (All Clients, Stalled, Upcoming Milestones)
- Engagement column in RecommendationsPortfolio with completion fraction and blocked dot indicator
- PublishActionPlanButton with confirmation dialog on guidance page
- MilestoneStatusControl with Block and Defer dialogs (reason required, optional revisit date)
- Portfolio engagement data fetching in recommendations page

## Key decisions

- Engagement column conditionally rendered (only when `trackingEnabled` is true)
- Unpublished clients show "--" in engagement column (zero noise per D-07)
- Publish button is always available (not gated by tracking flag per UI spec)
- Published badge replaces button after publish (no unpublish in this phase)
- Blocked indicator uses red dot with tooltip (6px, aria-labeled)

## Files changed

- `src/app/(protected)/advisor/engagement/page.tsx` (new)
- `src/components/engagement/EngagementDashboard.tsx` (new)
- `src/components/engagement/EngagementMetrics.tsx` (new)
- `src/components/engagement/MilestoneStatusControl.tsx` (new)
- `src/components/engagement/PublishActionPlanButton.tsx` (new)
- `src/components/recommendations/RecommendationsPortfolio.tsx` (extended)
- `src/app/(protected)/advisor/recommendations/page.tsx` (extended)
- `src/app/(protected)/advisor/clients/[clientId]/guidance/page.tsx` (extended)
