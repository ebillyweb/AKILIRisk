# Phase 22: Recommendation Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 22-recommendation-experience
**Areas discussed:** Advisor review workflow, Enterprise customization interface, Client action plan experience, Layer attribution display

---

## Advisor Review Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expansion | Each recommendation row expands in-place | |
| Slide-over panel | Right-side panel with full details | |
| Dedicated review page | Each recommendation links to its own page | |

**User's choice:** Dedicated review page, but fundamentally reframed. Not per-recommendation review -- per-client holistic Guidance Package review.

**Notes:** User rejected the concept of reviewing recommendations in isolation. Advisors should review the complete guidance for a client. Each recommendation shows: Insight, Evidence, Why It Matters, Recommended Action, Layer Attribution, Advisor Controls (Accept, Defer, Mark Already Addressed, Hide from Client, Add Notes, Adjust Priority). The advisor is validating guidance and deciding how it fits into the client's plan, not approving AI logic.

### Follow-up: Review Page Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-client guidance review | One page per client, all recommendations | |
| Per-assessment guidance review | One page per completed assessment | |
| Per-pillar guidance review | One page per pillar per client | |

**User's choice:** Per-client guidance review with extensive refinement. AKILI should produce a single holistic guidance package per client synthesized across ALL assessments. The guidance package is a living, cumulative artifact -- assessments enrich it rather than creating isolated reviews. Cross-assessment deduplication required (e.g., Governance and Succession both identifying need for governance charter = one consolidated recommendation).

**Notes:** Page sections defined: Executive Summary, Profile Insights, Attention Items, Recommended Actions, Evidence, Implementation Plan. Recommendations de-duplicated and merged where appropriate.

### Follow-up: Evidence Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Show triggering answers inline | Display actual questions and responses | |
| Show trigger summary only | One-liner with links to full assessment | |
| Show pillar scores + risk level | Score and risk level only | |

**User's choice:** Show triggering answers inline.

### Follow-up: Recommendation Lifecycle

**User's choice:** Simplified implementation-focused lifecycle:
Generated -> Reviewed -> Included in Action Plan -> In Progress -> Completed

Replaces the approval-centric model (PENDING -> REVIEWED -> ACCEPTED -> DECLINED -> COMPLETED).

### Follow-up: Defer Behavior

**User's choice:** "Defer" redefined as "acknowledged as appropriate but not yet actionable." Captures: required reason, optional revisit date, optional trigger event, advisor notes. Deferred items remain visible under "Future Considerations" and are re-evaluated during reassessments.

### Follow-up: Priority Control

| Option | Description | Selected |
|--------|-------------|----------|
| Advisor drag-and-drop reorder | Full manual control | |
| AKILI priority with advisor override | Platform sets order, advisor bumps up/down | |
| AKILI priority only | Platform determines order | |

**User's choice:** AKILI priority with advisor override.

---

## Enterprise Customization Interface

**User's choice:** Dedicated Enterprise Guidance section using inline inheritance model. Enterprise admins browse the platform catalog and create overlays, not copies.

**Notes:** User elevated this to a platform-wide architectural principle -- Platform Asset Catalog with four-layer inheritance (Platform -> Enterprise -> Advisor -> Client). Generic engine built in Phase 22, recommendations as first consumer. Three-tier override policy:
- Always Protected: Platform insight, evidence, explainability, risk rationale, confidence, supporting data
- Configurable: Implementation guidance, vendors, playbooks, cost, timeline, docs, compliance, report wording, advisor prompts, educational resources
- Enterprise Additions: Firm guidance, procedures, compliance, links, templates, contacts, providers
- Advisor Layer: Can hide enterprise guidance per client, add notes, change timing, add discussion topics. Cannot alter platform insight or evidence.

### Follow-up: Phase 22 Scope for Asset Catalog

| Option | Description | Selected |
|--------|-------------|----------|
| Recommendations-first, pattern documented | Build for recommendations, document pattern | |
| Generic asset catalog foundation | Full generic abstraction | |
| Generic schema, recommendations UI only | Generic engine + schema, UI for recommendations only | |

**User's choice:** Option 3 with refinement. Generic inheritance framework now (asset-agnostic from day one), but only build management UI for recommendations in Phase 22. Other asset types adopt in future phases without redesign.

---

## Client Action Plan Experience

**User's choice:** Phased roadmap evolved into "Strategic Action Plan" (renamed from Family Roadmap).

**Notes:** User provided detailed section structure:
- Executive Summary (readiness score, top priorities, key risks, recently completed)
- Immediate Priorities (0-90 days) with per-action detail
- Strategic Initiatives (3-12 months)
- Ongoing Practices (recurring activities)
- Progress Dashboard

Each action preserves full reasoning chain: Why recommended -> Expected Benefit -> Supporting Insights -> Implementation Guidance -> Success Criteria.

### Follow-up: Ownership Model

**User's choice:** Separate Role from Assignee. Platform-defined Responsible Roles (Client, Primary Advisor, Co-Advisor, Attorney, CPA, etc.) for reporting/filtering/automation. Freeform Assignee for specific person/org. Both support multiple entries and are editable.

### Follow-up: Client Self-Service

**User's choice:** Shared ownership model with two status tracks:
- Task Status (client-managed): Not Started, In Progress, Waiting on Someone Else, Ready for Review, Completed
- Validation Status (advisor-managed): Pending Review, Verified, Needs Follow-up
- Whether validation is required is configurable by platform/enterprise based on action type.

---

## Layer Attribution Display

| Option | Description | Selected |
|--------|-------------|----------|
| Full transparency for advisors, simplified for clients | Advisors see layers, clients see composed | |
| Full transparency for all roles | Everyone sees attribution | |
| Configurable per enterprise | Enterprise decides client visibility | |

**User's choice:** Full transparency for advisors, simplified for clients. Enterprise admins see platform + their overlay side by side.

---

## Claude's Discretion

- Generic asset catalog schema design
- Composition engine implementation approach
- API design for guidance package endpoints
- Cross-assessment recommendation deduplication algorithm
- UI component architecture and routing structure
- Migration strategy for existing lifecycle states

## Deferred Ideas

- Generic Platform Asset Catalog UI for non-recommendation asset types
- Workflow automation based on Responsible Role assignments
- Client-to-client collaboration on shared action items
- Integration with external project management tools
- AI-powered recommendation merging/dedup (rule-based in Phase 22, AI enhancement deferred)
