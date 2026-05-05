import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportControls } from "./ExportControls";

/**
 * /admin/exports — round-10 / E2 (BRD §5.3 data ownership + portability).
 *
 * Two cards:
 *   1. Per-tenant export — pick advisor → download ZIP
 *   2. System-wide export — confirmation gated, downloads all tenants
 *
 * The actual download invokes GET /api/admin/exports?scope=...&advisorProfileId=...
 * which streams a ZIP. Streaming sync per the design; large platforms
 * may hit the 50 MB cap and get a truncated download (documented in the
 * UI copy below).
 */
export default async function AdminExportsPage() {
  await requireAdminRole();

  const advisorProfiles = await prisma.advisorProfile.findMany({
    select: {
      id: true,
      firmName: true,
      brandName: true,
      user: { select: { email: true } },
    },
    orderBy: [{ firmName: "asc" }, { createdAt: "asc" }],
  });

  const advisorOptions = advisorProfiles.map((p) => ({
    advisorProfileId: p.id,
    label:
      p.brandName ||
      p.firmName ||
      p.user.email,
    email: p.user.email,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Data exports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          BRD §5.3 data ownership and portability. Generates a ZIP bundle
          with per-table CSVs, a single nested JSON, and a README. Streams
          synchronously with a 50&nbsp;MB byte cap; large platforms may
          truncate (use the per-tenant export instead, or wait for the
          async export feature).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-tenant export</CardTitle>
          <CardDescription>
            Pick an advisor. Bundle includes the advisor profile, every
            assigned client, intake interviews + responses, assessments +
            scores, household members, document requirements, and the
            tenant-scoped audit log (heap-merged across all 3 audit
            tables).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportControls advisorOptions={advisorOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System-wide export</CardTitle>
          <CardDescription>
            All tenants, organized as <code>tenants/&lt;advisorId&gt;/</code>
            subdirectories inside one ZIP. Iterates tenants serially.
            Subject to the 50&nbsp;MB cap; large deployments will truncate
            and require the async export path (TODO).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportControls advisorOptions={[]} systemOnly />
        </CardContent>
      </Card>
    </div>
  );
}
