import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";
import {
  runWhiteLabelPdfSmokeProbe,
  SMOKE_PDF_FIRM_NAME,
} from "@/lib/pdf/white-label-smoke-probe";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/pdf/white-label-smoke-probe
 *
 * Staff-only canary: render a synthetic AssessmentReport PDF with fixed
 * white-label branding. No assessment reads, no DB writes. Used by scheduled
 * `@smoke` tests to catch branding regressions in PDF generation.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = normalizeUserRoleString(session.user.role);
  if (role !== "ADVISOR" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runWhiteLabelPdfSmokeProbe();

    if (!result.usesWhiteLabelFirm) {
      return NextResponse.json(
        {
          error:
            "White-label PDF probe rendered without the expected firm branding",
          firmName: result.firmName,
          firmNameEmbedded: result.firmNameEmbedded,
          filenameSlugFirm: result.filenameSlugFirm,
        },
        { status: 502 },
      );
    }

    const expectedSlug = SMOKE_PDF_FIRM_NAME.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (result.filenameSlugFirm !== expectedSlug) {
      return NextResponse.json(
        {
          error: "White-label PDF probe filename slug mismatch",
          expectedSlug,
          filenameSlugFirm: result.filenameSlugFirm,
        },
        { status: 502 },
      );
    }

    return new NextResponse(Buffer.from(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filenameSlugFirm}-smoke-wl-report.pdf"`,
        "Cache-Control": "no-store",
        "X-Smoke-Firm-Name": SMOKE_PDF_FIRM_NAME,
        "X-Smoke-Firm-Slug": result.filenameSlugFirm,
        "X-Smoke-Firm-Embedded": result.firmNameEmbedded ? "1" : "0",
        "X-Smoke-Byte-Length": String(result.byteLength),
      },
    });
  } catch (error) {
    console.error("White-label PDF smoke probe failed:", error);
    const message =
      error instanceof Error ? error.message.slice(0, 240) : "Unknown error";
    return NextResponse.json(
      { error: `White-label PDF probe failed: ${message}` },
      { status: 500 },
    );
  }
}
