# AKILI Risk Management

## What This Is

A comprehensive family risk intelligence platform for wealth advisors. Features 10-pillar risk assessment (governance, cyber, identity, financial security), AI-powered recommendation engine with three-tier customization (platform, enterprise, advisor), full recommendation lifecycle from assessment through implementation tracking to executive reporting. Dual dashboard experience with advisor portfolio management and client self-service action plans.

## Core Value

Prevent family wealth from becoming family conflict through systematic risk assessment and actionable governance recommendations.

## Requirements

### Validated

- ✓ Secure user authentication with MFA -- v1.0
- ✓ Guided Family Governance assessment with branching logic -- v1.0 (68 questions, 8 categories)
- ✓ Weighted scoring algorithm (questions -> sub-categories -> pillar score) -- v1.0
- ✓ Risk identification system that surfaces specific missing controls -- v1.0
- ✓ Automated report generation (executive summary + detailed breakdown) -- v1.0
- ✓ Policy template generation with pre-filled recommendations -- v1.0 (7 templates)
- ✓ Real-time auto-save and smart resume functionality -- v1.0
- ✓ Household member profile management with governance roles -- v1.1
- ✓ Assessment personalization using household member names and composition -- v1.1
- ✓ Profile-aware question branching and filtering -- v1.1
- ✓ Household-aware PDF reports with composition tables and role-based recommendations -- v1.1
- ✓ Policy template pre-population with household member names and roles -- v1.1
- ✓ Extended family tracking for non-resident members -- v1.1
- ✓ 100% backward compatibility for assessments without profiles -- v1.1
- ✓ Step-by-step intake interview system with audio response capability -- v1.2
- ✓ Advisor portal for client intake review and management -- v1.2
- ✓ Risk area identification and approval workflow for advisors -- v1.2
- ✓ Assessment customization with 1.5x emphasis multipliers for advisor-selected focus areas -- v1.2
- ✓ Audio transcription via OpenAI Whisper integration -- v1.2
- ✓ Notification system for advisor-client communication -- v1.2
- ✓ Multi-client advisor dashboard with secure data isolation -- v1.3
- ✓ Governance analytics with trend visualizations and historical tracking -- v1.3
- ✓ Automated risk intelligence with portfolio-wide insights and drill-down capabilities -- v1.3
- ✓ Family self-service dashboard with household member display and advisor emphasis indicators -- v1.3
- ✓ Advisor client invitation system with registration link generation -- v1.4
- ✓ Client status tracking with visual pipeline progression -- v1.4
- ✓ Automated notification system for workflow stage transitions -- v1.4
- ✓ Document collection system with advisor branding and automated reminders -- v1.4
- ✓ Independent cyber risk assessment with scoring algorithm -- v1.5
- ✓ Identity risk insights and digital footprint analysis -- v1.5
- ✓ Financial cyber security practices evaluation -- v1.5
- ✓ Automated cyber risk recommendations system -- v1.5
- ✓ Advisor-guided cyber risk action plans -- v1.5
- ✓ Unified family risk profile with weighted composite scoring -- v1.5
- ✓ Three-tier recommendation lifecycle (platform, enterprise, advisor) -- v1.5
- ✓ Client strategic action plan with milestone tracking -- v1.5
- ✓ Continuous reassessment with score deltas and review cadence -- v1.5
- ✓ Executive reporting with branded PDF generation -- v1.5

### Active

(None -- next milestone requirements TBD)

### Out of Scope

- Real-time threat intelligence feeds -- batch processing sufficient for wealth management
- Penetration testing automation -- outside platform scope
- Mobile native app -- responsive web sufficient
- Real-time collaboration features -- single-user assessment works well
- Dark web monitoring -- deferred to v2
- FAIR methodology integration -- deferred to v2

## Current State

**Version:** v1.5 Cyber Risk Intelligence shipped 2026-06-28
**Codebase:** ~2.5M lines TypeScript/TSX
**Tech Stack:** Next.js 15, Prisma 7, PostgreSQL, Auth.js v5, @react-pdf/renderer, TanStack Query & React Table, Recharts, OpenAI (Whisper + gpt-4o-mini), AWS S3, Resend
**Assessment Coverage:** 10 pillars with household-aware personalization, intelligent filtering, and advisor-customized emphasis
**Security:** TOTP MFA, Argon2id password hashing, AES-256-GCM encryption, rate limiting, row-level data isolation
**Milestones shipped:** 6 (v1.0 through v1.5), 25 phases, 86 plans

**Platform Lifecycle:** Invitation -> Registration -> MFA -> Intake interview -> Advisor review -> Customized assessment -> Document upload -> Recommendations -> Action plan -> Implementation tracking -> Reassessment -> Executive reporting

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Family Governance first | Focused MVP scope | ✓ Good |
| Full-stack JavaScript | Consistent tech stack | ✓ Good |
| Weighted scoring model | Systematic risk quantification | ✓ Good |
| TOTP MFA for security | Enterprise security without SMS | ✓ Good |
| Server-side PDF generation | Professional formatting | ✓ Good |
| Cyber risk as parallel pillar | Domain separation prevents contamination | ✓ Good |
| calculatePillarScore reuse | Mathematical consistency across all pillars | ✓ Good |
| gpt-4o-mini for recommendations | Cost-effective structured output | ✓ Good |
| Three-tier override policy | Platform/enterprise/advisor layers composed at read time | ✓ Good |
| Clone-at-write for rule snapshots | Snapshot integrity for reproducibility | ✓ Good |
| Append-only SolutionActivity | Audit trail integrity | ✓ Good |
| Assessment version = chain length | Clean reassessment lineage | ✓ Good |
| ExecutiveReport as separate model | Independent lifecycle from assessment reports | ✓ Good |
| Executive Readiness tiers | Qualitative framing avoids misleading composite scores | ✓ Good |
| Feature flag gating for tracking | Zero-noise for advisors who opt out | ✓ Good |

## Constraints

- **Tech Stack**: Full-stack JavaScript -- validated across 6 milestones
- **Budget**: Minimal hosting costs -- achieved with efficient architecture
- **Security**: Enterprise-grade -- TOTP MFA, encryption, row-level isolation, role-based access
- **Performance**: Async processing with cached results, never blocking on external APIs

---
*Last updated: 2026-06-28 after v1.5 milestone*
