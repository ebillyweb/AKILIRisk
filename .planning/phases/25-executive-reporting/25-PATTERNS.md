# Phase 25: Executive Reporting - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `prisma/migrations/YYYYMMDD_executive_report/migration.sql` | migration | batch | `prisma/migrations/20260522120000_reporting_engine/migration.sql` | exact |
| `src/lib/pdf/build-executive-report-snapshot.ts` | service | CRUD | `src/lib/pdf/build-report-snapshot.ts` | exact |
| `src/lib/pdf/render-executive-report.tsx` | service | request-response | `src/lib/pdf/render-report.tsx` | exact |
| `src/lib/pdf/components/ExecutiveReport.tsx` | component | request-response | `src/lib/pdf/components/AssessmentReport.tsx` | exact |
| `src/lib/pdf/components/ExecReportCover.tsx` | component | request-response | `src/lib/pdf/components/ReportCover.tsx` | exact |
| `src/lib/pdf/components/AdvisorBriefDocument.tsx` | component | request-response | `src/lib/pdf/components/AssessmentReport.tsx` | role-match |
| `src/lib/pdf/executive-styles.ts` | utility | transform | `src/lib/pdf/styles.ts` | exact |
| `src/lib/actions/executive-report-actions.ts` | service | CRUD | `src/lib/actions/report-actions.ts` | exact |
| `src/lib/reports/executive-report-queries.ts` | service | CRUD | `src/lib/reports/queries.ts` | exact |
| `src/app/api/reports/executive/[reportId]/pdf/route.tsx` | controller | request-response | `src/app/api/reports/by-id/[reportId]/pdf/route.tsx` | exact |
| `src/app/api/reports/advisor-brief/[reportId]/pdf/route.tsx` | controller | request-response | `src/app/api/reports/by-id/[reportId]/pdf/route.tsx` | role-match |
| `src/app/(protected)/advisor/pipeline/[clientId]/executive-report/page.tsx` | component | request-response | `src/app/(protected)/advisor/pipeline/[clientId]/report/page.tsx` | exact |
| `src/app/(protected)/advisor/pipeline/[clientId]/executive-report/edit/page.tsx` | component | request-response | `src/app/(protected)/advisor/pipeline/[clientId]/report/edit/page.tsx` | exact |
| `src/components/reports/ExecutiveReportDraftForm.tsx` | component | request-response | `src/components/reports/EditDraftForm.tsx` | exact |

---

## Pattern Assignments

### `prisma/migrations/YYYYMMDD_executive_report/migration.sql` (migration, batch)

**Analog:** `prisma/migrations/20260522120000_reporting_engine/migration.sql`

**Core pattern** (lines 1-68 of analog):
```sql
-- New enum types go at the top before CREATE TABLE.
CREATE TYPE "ExecutiveReportStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "ExecutiveReportType" AS ENUM ('CLIENT_FACING', 'ADVISOR_BRIEF');

CREATE TABLE "ExecutiveReport" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "reportType" "ExecutiveReportType" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ExecutiveReportStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotData" JSONB,
    "brandingSnapshot" JSONB,
    "advisorNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExecutiveReport_pkey" PRIMARY KEY ("id")
);

-- Same index strategy as Report: assessmentId+status composite, publishedAt
-- chronological, and a partial unique for the one-DRAFT-per-type constraint.
CREATE UNIQUE INDEX "ExecutiveReport_assessmentId_type_version_key"
    ON "ExecutiveReport"("assessmentId", "reportType", "version");
CREATE INDEX "ExecutiveReport_assessmentId_type_status_idx"
    ON "ExecutiveReport"("assessmentId", "reportType", "status");
CREATE UNIQUE INDEX "ExecutiveReport_assessmentId_type_draft_unique"
    ON "ExecutiveReport"("assessmentId", "reportType")
    WHERE "status" = 'DRAFT';

ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
```

**Key conventions:**
- CASCADE DELETE on assessmentId (RTBF compliance — same as Report)
- SET NULL on publishedById (deleted advisor doesn't orphan rows)
- Partial unique index for one-DRAFT-per-(assessment, type) — Postgres-only syntax goes in raw SQL, not schema.prisma DSL
- Comment block at top explaining lifecycle semantics

---

### `src/lib/pdf/build-executive-report-snapshot.ts` (service, CRUD)

**Analog:** `src/lib/pdf/build-report-snapshot.ts`

**Imports pattern** (lines 16-24 of analog):
```typescript
import { prisma } from "@/lib/db";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
```

**Snapshot interface pattern** (lines 64-84 of analog):
```typescript
export interface ExecutiveReportSnapshot {
  schemaVersion: 1;
  reportType: "CLIENT_FACING" | "ADVISOR_BRIEF";
  // ... domain-specific fields for executive-grade content
  reportData: {
    // Aggregate across all pillars, not a single pillar
    overallScore: number;
    pillarScores: PillarScoreLite[];
    topRisks: TopRisk[];
    keyMetrics: KeyMetric[];
    generatedAt: string;
  };
  householdProfile: { members: SnapshotHouseholdMember[] } | null;
}
```

**Core function pattern** (lines 104-108 of analog):
```typescript
export async function buildExecutiveReportSnapshot(
  assessmentId: string,
  options: BuildExecutiveSnapshotOptions = {}
): Promise<ExecutiveReportSnapshot> {
  // 1. Load assessment
  // 2. Load ALL pillar scores (not just one pillar)
  // 3. Load household profile
  // 4. Compute aggregate metrics
  // Return snapshot — pure read, no side effects, throws on missing data
}

export async function buildBrandingSnapshot(assessmentId: string) {
  // REUSE this function directly from build-report-snapshot.ts
  // via re-export or direct import — do not duplicate
}
```

**Key conventions:**
- Pure read-only; no Prisma writes
- Throws when data is missing (caller converts to structured error)
- `schemaVersion: 1` field for future migration path
- `buildBrandingSnapshot` already exists in `build-report-snapshot.ts` — import and re-export, do not duplicate

---

### `src/lib/pdf/render-executive-report.tsx` (service, request-response)

**Analog:** `src/lib/pdf/render-report.tsx`

**Full pattern** (lines 1-79 of analog):
```typescript
import { renderToBuffer } from "@react-pdf/renderer";
import { ExecutiveReport } from "@/lib/pdf/components/ExecutiveReport";
import { createBrandedPDFMetadata } from "@/lib/pdf/branding-integration";
import {
  buildExecutiveReportSnapshot,
  type ExecutiveReportSnapshot,
} from "@/lib/pdf/build-executive-report-snapshot";
import { buildBrandingSnapshot } from "@/lib/pdf/build-report-snapshot";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface RenderInput {
  snapshot: ExecutiveReportSnapshot;
  branding: AdvisorBrandingData | null;
  draft: boolean;
}

export interface RenderResult {
  bytes: Uint8Array;
  filenameSlugFirm: string;
}

/** Pure render: snapshot + branding -> PDF bytes. No auth, no audit, no Prisma. */
export async function renderExecutiveReportPdf(input: RenderInput): Promise<RenderResult> {
  // Same shape as renderReportPdf in render-report.tsx
}

export async function renderLiveExecutivePreview(assessmentId: string): Promise<RenderResult> {
  const snapshot = await buildExecutiveReportSnapshot(assessmentId);
  const branding = await buildBrandingSnapshot(assessmentId);
  return renderExecutiveReportPdf({ snapshot, branding, draft: true });
}
```

**Key conventions:**
- `.tsx` extension (not `.ts`) because it renders JSX via `renderToBuffer`
- Pure function; all side effects live in the route or action layers
- Filename slug uses same `brandName || advisorFirmName || "akili-risk"` fallback chain

---

### `src/lib/pdf/components/ExecutiveReport.tsx` (component, request-response)

**Analog:** `src/lib/pdf/components/AssessmentReport.tsx`

**Structure pattern** (full file of analog):
```typescript
import { Document } from "@react-pdf/renderer";
import { ExecReportCover } from "./ExecReportCover";
// ... additional section components

interface ExecutiveReportProps {
  data: ExecutiveReportData;   // snapshot.reportData shape
  householdProfile?: HouseholdProfile;
  advisorBranding?: AdvisorBranding;
  documentMetadata?: PdfDocumentMetadata;
  draft?: boolean;
}

export function ExecutiveReport({ data, householdProfile, advisorBranding, documentMetadata, draft }: ExecutiveReportProps) {
  const companyName = advisorBranding?.firmName || "Akili Risk";
  return (
    <Document title={...} author={...} subject={...} creator={...}>
      <ExecReportCover ... draft={draft} />
      {/* Section pages, each receives companyName + draft prop */}
    </Document>
  );
}
```

**Key conventions:**
- `draft` prop threads through to every page component's `<DraftWatermark />` conditional
- `companyName` computed once at the Document level, passed to all page components
- `documentMetadata` comes from `createBrandedPDFMetadata(branding)` at the render layer

---

### `src/lib/pdf/components/ExecReportCover.tsx` (component, request-response)

**Analog:** `src/lib/pdf/components/ReportCover.tsx`

**Core page pattern** (lines 41-97 of analog):
```typescript
import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles } from "../styles";  // or executive-styles.ts for new styles
import { PageFooter } from "./PageFooter";
import { paletteForRiskLevel } from "@/lib/assessment/risk-color-palette";
import { DraftWatermark } from "./DraftWatermark";

export function ExecReportCover({ ..., draft }: ExecReportCoverProps) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Content */}
      <PageFooter companyName={advisorBranding?.firmName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
```

**Key conventions:**
- Always `<Page size="A4">` wrapper
- `<PageFooter>` at end of each page (renders fixed position footers)
- `{draft ? <DraftWatermark /> : null}` as final child of Page
- Logo via `<Image src={advisorBranding.logoUrl} />` with conditional render guard

---

### `src/lib/pdf/executive-styles.ts` (utility, transform)

**Analog:** `src/lib/pdf/styles.ts`

**Core pattern** (full file of analog):
```typescript
import { StyleSheet } from "@react-pdf/renderer";

export const executiveStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 72,
    lineHeight: 1.5,
    color: "#374151",
  },
  // ... extend with executive-specific styles
});
```

**Key conventions:**
- `StyleSheet.create({})` call wraps all styles (react-pdf requirement)
- Color palette: `#1a1a2e` for headings, `#374151` for body, `#6b7280` for muted
- Padding: `72` units horizontal and vertical on pages
- Extend `styles` from `styles.ts` where the styles are shared, or import and spread

---

### `src/lib/actions/executive-report-actions.ts` (service, CRUD)

**Analog:** `src/lib/actions/report-actions.ts`

**File header + result type** (lines 1-49 of analog):
```typescript
"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { buildExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";
import { buildBrandingSnapshot } from "@/lib/pdf/build-report-snapshot";

export type ReportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };
```

**Auth helper pattern** (lines 57-109 of analog):
```typescript
async function requireSession(): Promise<SessionInfo> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("not_authenticated");
  return { userId: session.user.id, role: session.user.role ?? "USER", email: session.user.email ?? null };
}

async function authorizeForAssessment(session, assessmentId) {
  // Check ADMIN bucket first (isPlatformAdminRole)
  // Then check ADVISOR bucket (advisorProfile + clientAdvisorAssignment ACTIVE)
  // Return { ok: true, bucket: "ADMIN" | "ADVISOR", assessment }
  // or { ok: false, code: "not_found" | "forbidden" }
}
```

**Publish transaction pattern** (lines 311-431 of analog):
```typescript
export async function publishExecutiveReport(reportId: string): Promise<ReportActionResult<...>> {
  // 1. requireSession() + authorizeForAssessment()
  // 2. Build snapshot OUTSIDE the transaction (expensive, read-only)
  const snapshot = await buildExecutiveReportSnapshot(draft.assessmentId);
  const branding = await buildBrandingSnapshot(draft.assessmentId);
  // 3. prisma.$transaction() containing:
  //    - Re-read draft under txn to detect races
  //    - updateMany PUBLISHED -> SUPERSEDED for same assessmentId+reportType
  //    - update DRAFT -> PUBLISHED with snapshotData + brandingSnapshot
  //    - create next DRAFT at version+1 inheriting editorial fields
  // 4. void writeAudit(...) AFTER transaction completes
  // 5. Catch P2002 -> { ok: false, code: "concurrent_publish" }
}
```

**Key conventions:**
- `"use server"` at top of file (no blank line before it)
- All public functions return `ReportActionResult<T>` — never throw to the caller
- `requireSession()` + `authorizeForAssessment()` are private helpers, not exported
- Snapshot building happens OUTSIDE the transaction to avoid locking window
- `void writeAudit(...)` is fire-and-forget (do not await)
- P2002 (unique constraint violation from partial unique index) = concurrent publish race

---

### `src/lib/reports/executive-report-queries.ts` (service, CRUD)

**Analog:** `src/lib/reports/queries.ts`

**Imports + return type pattern** (lines 1-25 of analog):
```typescript
import { prisma } from "@/lib/db";

export interface ExecutiveReportListRow {
  id: string;
  reportType: "CLIENT_FACING" | "ADVISOR_BRIEF";
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  publishedAt: Date | null;
  publishedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Query function pattern** (lines 32-73 of analog):
```typescript
export async function getExecutiveReportListForClient(clientUserId: string): Promise<{
  assessmentId: string;
  reports: ExecutiveReportListRow[];
} | null> {
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: clientUserId },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!latestAssessment) return null;
  // ... findMany on ExecutiveReport, map to row shape
}
```

**Key conventions:**
- No auth gating in query helpers — auth is caller's responsibility (same comment pattern as analog)
- `null` return when no assessment exists (not empty array)
- Queries always select minimum fields needed for the UI

---

### `src/app/api/reports/executive/[reportId]/pdf/route.tsx` (controller, request-response)

**Analog:** `src/app/api/reports/by-id/[reportId]/pdf/route.tsx`

**Full route pattern** (lines 1-172 of analog):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { renderExecutiveReportPdf } from "@/lib/pdf/render-executive-report";
import { buildExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";
import { buildBrandingSnapshot } from "@/lib/pdf/build-report-snapshot";
import type { ExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { reportId } = await params;

    // 1. Resolve report row
    // 2. Auth gate: isOwner || isAdmin || isAssignedAdvisor
    //    (same three-bucket check as the analog)
    // 3. Clients cannot see DRAFT rows (403, not 404)
    // 4. PUBLISHED/SUPERSEDED: render from frozen snapshotData + brandingSnapshot
    //    DRAFT: build live snapshot + branding, render with draft:true watermark
    // 5. Return new NextResponse(bytes as unknown as BodyInit, { headers: {...} })
    //    with Content-Type: application/pdf + Content-Disposition filename
    //    + Cache-Control: no-cache, no-store, must-revalidate
  } catch (error) {
    console.error("Error rendering Executive Report PDF:", error);
    return NextResponse.json({ error: "Failed to render report" }, { status: 500 });
  }
}
```

**Response headers pattern** (lines 156-164 of analog):
```typescript
return new NextResponse(pdfBuffer as unknown as BodyInit, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${firmSlug}-${versionSlug}-executive-report.pdf"`,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
});
```

**Key conventions:**
- File extension `.tsx` (JSX in render path)
- Auth gate identical to existing routes: owner || admin || assigned advisor
- DRAFT rows: advisor/admin only — clients blocked with 403
- No audit write in this route (audit lives at action layer, not download layer, per existing convention for the by-id route)

---

### `src/app/(protected)/advisor/pipeline/[clientId]/executive-report/page.tsx` (component, request-response)

**Analog:** `src/app/(protected)/advisor/pipeline/[clientId]/report/page.tsx`

**Server component auth pattern** (lines 24-55 of analog):
```typescript
export default async function AdvisorExecutiveReportListPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: `/advisor/pipeline/${clientId}/executive-report` }));
  }
  if (!isAdvisorHubNavRole(session.user.role)) notFound();

  // Active-assignment gate. Admins skip.
  if (session.user.role === "ADVISOR") {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!advisor) notFound();
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { advisorId: advisor.id, clientId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!assignment) notFound();
  }

  // Load report list, render UI
}
```

**UI pattern** (lines 59-166 of analog):
```typescript
// Container with Back link
<div className="container mx-auto py-6">
  <div className="mb-6">
    <Link href={`/advisor/pipeline/${clientId}`} className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to client
    </Link>
  </div>
  <div className="mb-8">
    <h1 className="text-3xl font-bold">Executive Reports</h1>
    <p className="mt-2 text-muted-foreground">...</p>
  </div>
  {/* Card with report list, Badge for status, Download button linking to /api/reports/executive/[id]/pdf */}
</div>
```

**Key conventions:**
- Server component (no `"use client"`)
- `isAdvisorHubNavRole` check before assignment check — same two-step guard
- 404 (opaque) for all auth failures — never 403 in page components
- Back link always goes to `/advisor/pipeline/${clientId}`
- `<Badge variant={...}>` with `"success"` for PUBLISHED, `"outline"` for DRAFT, `"secondary"` for SUPERSEDED

---

### `src/app/(protected)/advisor/pipeline/[clientId]/executive-report/edit/page.tsx` (component, request-response)

**Analog:** `src/app/(protected)/advisor/pipeline/[clientId]/report/edit/page.tsx`

**Pattern** (full file of analog):
```typescript
// Server component shell — auth + data fetch, passes to client form component
// Same auth guard: session -> isAdvisorHubNavRole -> ADVISOR assignment check
// Call getOrCreateExecutiveDraft(latestAssessment.id) (idempotent)
// Load draft data via getExecutiveDraftData(clientId)
// Render <ExecutiveReportDraftForm ... /> client component
```

**Key conventions:**
- Returns empty-state UI (not notFound()) when no assessment exists yet
- Uses `getOrCreateDraft` equivalent from `executive-report-actions.ts` to ensure DRAFT always exists before rendering the form
- Server component passes fully-resolved props to the client form — no client-side data fetching

---

### `src/components/reports/ExecutiveReportDraftForm.tsx` (component, request-response)

**Analog:** `src/components/reports/EditDraftForm.tsx`

**Client component pattern** (lines 1-17 of analog):
```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Save, Send, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
```

**Save/Publish handler pattern** (lines 84-130 of analog):
```typescript
const handleSave = async (): Promise<boolean> => {
  setSaving(true);
  try {
    const result = await saveExecutiveDraftEdits({ reportId: draft.id, ... });
    if (!result.ok) { toast.error(result.message); return false; }
    toast.success("Draft saved");
    return true;
  } catch (err) {
    console.error(err);
    toast.error("Failed to save draft");
    return false;
  } finally {
    setSaving(false);
  }
};

const handlePublish = async () => {
  const ok = await handleSave();
  if (!ok) return;
  // ... call publishExecutiveReport, navigate on success
};
```

**Key conventions:**
- `"use client"` at top
- Save-before-publish pattern (handlePublish calls handleSave first)
- `useTransition` wraps `router.push` + `router.refresh()` for non-blocking navigation
- `toast.error` for all failure paths, `toast.success` for successful save/publish
- Preview button = `<a href="/api/reports/executive/[id]/pdf" target="_blank">` (not a Next Link)
- Character counter rendered inline next to the textarea label

---

## Shared Patterns

### Authentication in server actions
**Source:** `src/lib/actions/report-actions.ts` lines 57-109
**Apply to:** `executive-report-actions.ts`
```typescript
async function requireSession(): Promise<SessionInfo> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("not_authenticated");
  return { userId: session.user.id, role: session.user.role ?? "USER", email: session.user.email ?? null };
}
```

### Auth in route handlers
**Source:** `src/app/api/reports/by-id/[reportId]/pdf/route.tsx` lines 68-94
**Apply to:** Both new PDF route handlers
```typescript
const isOwner = ownerUserId === sessionUserId;
const isAdmin = isPlatformAdminRole(sessionRole ?? undefined);
let isAssignedAdvisor = false;
if (!isOwner && !isAdmin && sessionRole === "ADVISOR") {
  const advisor = await prisma.advisorProfile.findUnique({ where: { userId: sessionUserId }, select: { id: true } });
  if (advisor) {
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { advisorId: advisor.id, clientId: ownerUserId, status: "ACTIVE" },
      select: { id: true },
    });
    isAssignedAdvisor = assignment != null;
  }
}
if (!isOwner && !isAdmin && !isAssignedAdvisor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### Audit logging
**Source:** `src/lib/actions/report-actions.ts` lines 433-452
**Apply to:** `executive-report-actions.ts` (publish action only)
```typescript
void writeAudit({
  actor: { userId: session.userId, role: session.role, email: session.email },
  action: AUDIT_ACTIONS.REPORT_PUBLISH,  // add EXECUTIVE_REPORT_PUBLISH to AUDIT_ACTIONS
  entityType: "ExecutiveReport",
  entityId: result.publishedId,
  beforeData: { version: draft.version },
  afterData: { version: result.version, status: "PUBLISHED" },
  metadata: { assessmentId: draft.assessmentId, supersededReportId: result.supersededReportId },
});
```

### Concurrent publish error handling
**Source:** `src/lib/actions/report-actions.ts` lines 488-510
**Apply to:** `executive-report-actions.ts`
```typescript
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { ok: false, code: "concurrent_publish", message: "Another publish landed first. Refresh and try again." };
  }
  if (err instanceof Error && err.message === "draft_disappeared") {
    return { ok: false, code: "concurrent_publish", message: "This draft was already published." };
  }
  throw err;
}
```

### Draft watermark on PDF pages
**Source:** `src/lib/pdf/components/DraftWatermark.tsx`
**Apply to:** All new PDF page components
```typescript
import { DraftWatermark } from "./DraftWatermark";
// At end of Page JSX:
{draft ? <DraftWatermark /> : null}
```

### Page footer on PDF pages
**Source:** `src/lib/pdf/components/PageFooter.tsx`
**Apply to:** All new PDF page components
```typescript
import { PageFooter } from "./PageFooter";
// Before DraftWatermark:
<PageFooter companyName={companyName} />
```

### Branding snapshot resolution
**Source:** `src/lib/pdf/build-report-snapshot.ts` lines 280-292
**Apply to:** `build-executive-report-snapshot.ts` (re-export `buildBrandingSnapshot`)
```typescript
// Import directly — do not duplicate this function
import { buildBrandingSnapshot } from "@/lib/pdf/build-report-snapshot";
export { buildBrandingSnapshot };
```

### Page component auth guard (server components)
**Source:** `src/app/(protected)/advisor/pipeline/[clientId]/report/page.tsx` lines 38-55
**Apply to:** Both new advisor page routes
```typescript
if (!isAdvisorHubNavRole(session.user.role)) notFound();
if (session.user.role === "ADVISOR") {
  const advisor = await prisma.advisorProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!advisor) notFound();
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { advisorId: advisor.id, clientId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assignment) notFound();
}
```

---

## No Analog Found

All files have close analogs. The following are adaptations rather than net-new:

| File | Note |
|---|---|
| `src/lib/pdf/components/AdvisorBriefDocument.tsx` | No "internal brief" PDF exists yet; use `AssessmentReport.tsx` as structural template but content sections differ |
| Native chart/visualization components in PDF | `RiskHeatMapPdf` in `src/lib/pdf/components/RiskHeatMap.tsx` is the only react-pdf chart; copy its `StyleSheet.create` inline style pattern for bar charts or sparklines |

---

## Metadata

**Analog search scope:** `src/lib/pdf/`, `src/lib/actions/`, `src/lib/reports/`, `src/app/api/reports/`, `src/app/(protected)/advisor/pipeline/`, `src/components/reports/`, `prisma/migrations/`
**Files scanned:** 28
**Pattern extraction date:** 2026-06-27
