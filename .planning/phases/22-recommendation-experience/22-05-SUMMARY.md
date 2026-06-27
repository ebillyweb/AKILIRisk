---
phase: 22-recommendation-experience
plan: "05"
subsystem: enterprise-guidance-customization
tags: [enterprise, overlay-editor, composed-preview, two-column-layout, sheet]
dependency_graph:
  requires: [enterprise-overlay-actions, override-policy]
  provides: [enterprise-guidance-page, overlay-field-editor, composed-preview-sheet]
  affects: []
tech_stack:
  added: [shadcn-sheet]
  patterns: [two-column-overlay-editor, client-side-composition, per-field-policy-enforcement]
key_files:
  created:
    - src/app/(protected)/advisor/enterprise/guidance/page.tsx
    - src/components/enterprise/GuidanceCustomization.tsx
    - src/components/enterprise/OverlayFieldEditor.tsx
    - src/components/enterprise/ComposedPreviewSheet.tsx
    - src/components/ui/sheet.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Installed shadcn Sheet component as dependency for ComposedPreviewSheet"
  - "Client-side composition in preview avoids server round-trip for real-time form preview"
  - "GuidanceCustomization groups catalog by category with nested selectable cards"
metrics:
  duration: "227s"
  completed: "2026-06-27T05:33:21Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 2
---

# Phase 22 Plan 05: Enterprise Guidance Customization Summary

Enterprise guidance customization page with two-column overlay editor (platform definition read-only + enterprise overlay editable) and composed preview sheet showing three-layer source attribution per field.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Enterprise guidance route and two-column overlay editor | b54b2bd | page.tsx, GuidanceCustomization.tsx, OverlayFieldEditor.tsx, sheet.tsx |
| 2 | Composed preview sheet | a4d49b8 | ComposedPreviewSheet.tsx |

## What Was Built

**Enterprise guidance route (page.tsx):** Server component at /advisor/enterprise/guidance with requireAdvisorRole + requireEnterpriseTeamManager auth guards. Loads all active ServiceRecommendation entries and existing enterprise overlays. Hero surface uses exact UI-SPEC copywriting: "Enterprise Guidance" kicker, "Guidance Customization" title, enterprise name displayed.

**GuidanceCustomization.tsx:** Two-column layout with left panel (40%, bg-muted/40) for catalog browse grouped by category, right panel (60%) for overlay editor. Selecting a recommendation shows Platform Definition (read-only Card with "Platform -- Protected" Badge) and Enterprise Overlay (editable form). Dirty state tracked with yellow dot indicator. Save calls upsertEnterpriseOverlay action. Preview button opens ComposedPreviewSheet.

**OverlayFieldEditor.tsx:** Per-field overlay editor with three policy tier modes. PROTECTED fields show platform value with lock icon and disabled state. CONFIGURABLE fields show platform value as reference with editable overlay input. ADDITION fields show editable-only controls. Supports text, textarea, number, checkbox, links (dynamic array with add/remove), and playbook (dynamic step array with title/description/duration/sortOrder).

**ComposedPreviewSheet.tsx:** Right-side Sheet (sm:max-w-xl) showing composed preview. Client-side composition merges platform + enterprise overlay form values + optional advisor customization. Each field has source attribution badge (Platform bg-muted, Enterprise bg-secondary, Advisor bg-brand/15). Playbook shows combined ordered steps from all layers. Sheet is entirely read-only.

## Checkpoint Pending

Task 3 (checkpoint:human-verify) is pending human verification of the enterprise overlay workflow at /advisor/enterprise/guidance.

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
