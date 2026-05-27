import { NextResponse } from "next/server";
import type { Prisma, ReportStatus } from "@prisma/client";

import { requireAdminRole } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";

type ReportStatusFilter = "ALL" | ReportStatus;

function toStatusFilter(value: string | null): ReportStatusFilter {
  if (value === "PUBLISHED" || value === "DRAFT" || value === "SUPERSEDED") {
    return value;
  }
  return "ALL";
}

function parseDateInput(raw: string | null): Date | null {
  if (!raw) return null;
  const normalized = raw.length === 10 ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvEscape(value: string): string {
  if (!value) return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvLine(values: string[]): string {
  return values.map(csvEscape).join(",");
}

function fileDate(raw: Date): string {
  return raw.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireAdminRole();

    const url = new URL(request.url);
    const status = toStatusFilter(url.searchParams.get("status"));
    const query = (url.searchParams.get("q") ?? "").trim();
    const fromDate = parseDateInput(url.searchParams.get("from"));
    const toDateRaw = parseDateInput(url.searchParams.get("to"));
    const toDate = toDateRaw
      ? new Date(Date.UTC(
          toDateRaw.getUTCFullYear(),
          toDateRaw.getUTCMonth(),
          toDateRaw.getUTCDate(),
          23,
          59,
          59,
          999
        ))
      : null;

    const where: Prisma.ReportWhereInput = {
      ...(status === "ALL" ? {} : { status }),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { id: { contains: query, mode: "insensitive" } },
              { assessmentId: { contains: query, mode: "insensitive" } },
              {
                assessment: {
                  user: {
                    name: { contains: query, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        assessmentId: true,
        version: true,
        status: true,
        templateChoice: true,
        createdAt: true,
        publishedAt: true,
        assessment: {
          select: {
            user: {
              select: {
                name: true,
                emailCiphertext: true,
                clientAssignments: {
                  where: { status: "ACTIVE" },
                  select: {
                    advisor: {
                      select: {
                        firmName: true,
                        brandName: true,
                        user: {
                          select: {
                            emailCiphertext: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const header = [
      "report_id",
      "assessment_id",
      "client_name",
      "client_email",
      "active_advisor_emails",
      "active_advisor_firms",
      "status",
      "version",
      "template_choice",
      "created_at",
      "published_at",
    ];

    const lines = [toCsvLine(header)];
    for (const report of reports) {
      const clientName = report.assessment.user.name?.trim() || "";
      const clientEmail = decryptUserEmail(report.assessment.user.emailCiphertext);
      const activeAdvisorEmails = report.assessment.user.clientAssignments
        .map((assignment) =>
          decryptUserEmail(assignment.advisor.user.emailCiphertext)
        )
        .join("; ");
      const activeAdvisorFirms = report.assessment.user.clientAssignments
        .map(
          (assignment) =>
            assignment.advisor.firmName?.trim() ||
            assignment.advisor.brandName?.trim() ||
            ""
        )
        .filter((value) => value.length > 0)
        .join("; ");
      lines.push(
        toCsvLine([
          report.id,
          report.assessmentId,
          clientName,
          clientEmail,
          activeAdvisorEmails,
          activeAdvisorFirms,
          report.status,
          String(report.version),
          report.templateChoice,
          report.createdAt.toISOString(),
          report.publishedAt?.toISOString() ?? "",
        ])
      );
    }

    const filename = `admin-reports-${fileDate(new Date())}.csv`;
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Admin reports export error:", error);
    return new NextResponse(null, { status: 500 });
  }
}
