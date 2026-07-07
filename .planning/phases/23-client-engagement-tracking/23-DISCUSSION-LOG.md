# Phase 23: Discussion Log

**Date:** 2026-06-27
**Areas discussed:** 4/4

## Opt-in Mechanics

**Q: How should implementation tracking activate?**
Options: Auto-activate on first action | Explicit per-client toggle | Enterprise-level feature flag
**User clarified:** Enterprise feature flag + automatic activation on Action Plan publish. Three-layer model: enterprise enables capability, advisor publishes action plan (implicit activation), client sees tracking only when published.
**Decisions:** D-01, D-02, D-03

## Activity Feed Design

**Q: What activity feed style fits the advisor/client experience?**
Options: Chronological timeline | Grouped by recommendation | Both with toggle
**Selected:** Chronological timeline
**Decision:** D-04, D-05

**Q: How should the activity feed handle zero-state and placement?**
Options: Inline on Action Plan page | Separate Activity tab/page | Sidebar panel
**Selected:** Inline on Action Plan page
**Decision:** D-06

## Engagement Dashboard

**Q: What should the advisor portfolio show for engagement metrics?**
Options: Engagement column in existing table | Dedicated engagement dashboard | Both
**Selected:** Both column + dashboard
**Decisions:** D-07, D-08

**Q: What should the client dashboard show when tracking is active?**
Options: Enhanced Action Plan with progress bars + next step | Separate progress page | Card-based overview
**Selected:** Enhanced Action Plan with progress bars + next step
**Decision:** D-09

## Milestone Controls

**Q: How should client milestone self-service work?**
Options: Client updates task status, advisor manages milestones | Client manages milestones directly | Configurable per recommendation
**Selected:** Client updates task status, advisor manages milestones
**Decision:** D-10

**Q: How should auto-completion and new statuses work?**
Options: Auto-complete + Blocked/Deferred | Manual completion only | Auto-complete with advisor confirmation
**Selected:** Auto-complete + Blocked/Deferred on milestones
**Decisions:** D-11, D-12

## Deferred Ideas

- Reminder/notification engine for milestones -- Phase 24
- Client-to-client collaboration on shared actions
- External PM tool integration
- AI stall detection
- Bulk milestone operations
- Engagement metrics in PDF reports -- Phase 25
