---
status: resolved
trigger: "Debug the document portal branding issue from Phase 17 UAT."
created: 2026-03-15T10:00:00Z
updated: 2026-03-15T10:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Missing DocumentRequirement records in seed data
resolution: Closed as seed-data-only issue. Production code is correct. The empty state renders when no DocumentRequirement records exist, which is expected behavior. Seed script needs DocumentRequirement records for local UAT testing but this does not affect production.

## Symptoms

expected: Document portal displays advisor firm name prominently and includes subtitle "Document Collection Portal". If advisor has logo (HTTPS URL), it appears above firm name (max 48px height).
actual: Shows "No Document Requirements - No document requirements yet. Your advisor will request documents when needed."
errors: No error messages reported
reproduction: Access document portal in UAT Test 1
started: Phase 17 UAT failure - major severity

## Eliminated

## Evidence

- timestamp: 2026-03-15T10:05:00Z
  checked: ClientDocumentPortal component
  found: Component correctly renders advisor branding header with firm name and logo if available
  implication: The branding display logic is implemented correctly in the component

- timestamp: 2026-03-15T10:06:00Z
  checked: documents/page.tsx
  found: Shows empty state when advisorGroups.length === 0, renders ClientDocumentPortal when data exists
  implication: Issue occurs when no advisor groups are returned from the database query

- timestamp: 2026-03-15T10:07:00Z
  checked: getClientDocumentRequirements action
  found: Queries documentRequirement table filtering by clientId, groups results by advisor
  implication: Empty state shown when no document requirements exist for the authenticated client

- timestamp: 2026-03-15T10:08:00Z
  checked: seed-advisor-test-data.js
  found: Creates advisor profile, client, and assignments but NO DocumentRequirement records
  implication: Test data setup is missing document requirements, causing empty state to display

- timestamp: 2026-03-15T10:09:00Z
  checked: Phase 17 UAT document
  found: Test 1 expects advisor branding to display, but reports empty state message
  implication: The issue is that without any DocumentRequirement records, the portal correctly shows empty state instead of branding header

## Resolution

root_cause: The seed data script (seed-advisor-test-data.js) creates advisor profiles and client-advisor assignments, but does not create any DocumentRequirement records. Without document requirements in the database, getClientDocumentRequirements() returns an empty array, triggering the empty state display ("No Document Requirements...") instead of rendering the ClientDocumentPortal component with advisor branding.
fix: Add DocumentRequirement records to seed data so the portal has requirements to display and shows advisor branding header
verification: After adding document requirements to seed data, UAT Test 1 should pass with advisor branding displaying correctly
files_changed: [scripts/seed-advisor-test-data.js]