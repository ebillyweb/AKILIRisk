/**
 * §4.5 commit 3 (BRD §4.5) — one-shot backfill: synthesize a v=1
 * PUBLISHED Report + v=2 DRAFT for every Assessment that has at least
 * one calculated PillarScore.
 *
 *   npx tsx scripts/backfill-reports.ts
 *
 * Idempotent: skips assessments that already have any Report row, so
 * re-running after a partial failure is safe.
 *
 * Audit:
 *   • One REPORT_BACKFILL row per inserted Report (entityId = the
 *     Assessment id; metadata.reportId = the new PUBLISHED row).
 *   • One REPORT_BACKFILL_SUMMARY row at the end with processed +
 *     skipped + failed counts. System actor (actorUserId: null).
 *
 * Design proposal §5 sign-off: per-assessment audit rows for traceability.
 */

import "./load-repo-env";
import { Prisma } from "@prisma/client";
import { prisma, disconnectPrismaScript } from "./lib/prisma-for-scripts";
import {
  buildReportSnapshot,
  buildBrandingSnapshot,
} from "../src/lib/pdf/build-report-snapshot";
import { AUDIT_ACTIONS, writeAudit } from "../src/lib/audit/audit-log-core";
import {
  processOneAssessment,
  type BackfillDeps,
} from "../src/lib/reports/backfill-core";

const PAGE_SIZE = 100;

const deps: BackfillDeps = {
  async loadAssessment(assessmentId) {
    const a = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        userId: true,
        scores: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
          select: { calculatedAt: true },
        },
      },
    });
    if (!a) return null;
    return {
      id: a.id,
      userId: a.userId,
      latestCalculatedAt: a.scores[0]?.calculatedAt ?? null,
    };
  },
  async hasExistingReport(assessmentId) {
    const existing = await prisma.report.findFirst({
      where: { assessmentId },
      select: { id: true },
    });
    return existing != null;
  },
  buildSnapshot: buildReportSnapshot,
  buildBranding: buildBrandingSnapshot,
  async insertSyntheticPublishedAndDraft(input) {
    return prisma.$transaction(async (tx) => {
      const published = await tx.report.create({
        data: {
          assessmentId: input.assessmentId,
          version: 1,
          status: "PUBLISHED",
          templateChoice: input.templateChoice,
          snapshotData: input.snapshot as unknown as Prisma.InputJsonValue,
          brandingSnapshot: (input.branding ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          publishedAt: input.publishedAt,
          publishedById: null, // No human published — this is a backfill.
        },
        select: { id: true },
      });
      await tx.report.create({
        data: {
          assessmentId: input.assessmentId,
          version: 2,
          status: "DRAFT",
          templateChoice: input.templateChoice,
        },
      });
      return { publishedReportId: published.id };
    });
  },
};

async function main(): Promise<void> {
  console.log("§4.5 commit 3 — Report backfill starting…");

  let cursor: string | undefined;
  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (;;) {
    const batch: Array<{ id: string }> = await prisma.assessment.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (batch.length === 0) break;

    for (const row of batch) {
      processed += 1;
      try {
        const result = await processOneAssessment(row.id, deps);
        if (result.status === "inserted") {
          inserted += 1;
          // One audit row per insert. Fire-and-forget; failures here
          // shouldn't roll back the synthetic publish.
          void writeAudit({
            actor: { userId: null, role: null, email: null },
            action: AUDIT_ACTIONS.REPORT_BACKFILL,
            entityType: "Assessment",
            entityId: row.id,
            metadata: {
              reportId: result.publishedReportId,
            },
          });
        } else {
          skipped += 1;
        }

        if (processed % 50 === 0) {
          console.log(
            `  …processed ${processed} (inserted=${inserted} skipped=${skipped} failed=${failed})`
          );
        }
      } catch (err) {
        failed += 1;
        console.error(
          `✗ assessment ${row.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    cursor = batch[batch.length - 1]?.id;
    if (batch.length < PAGE_SIZE) break;
  }

  console.log(
    `Done. processed=${processed} inserted=${inserted} skipped=${skipped} failed=${failed}`
  );

  void writeAudit({
    actor: { userId: null, role: null, email: null },
    action: AUDIT_ACTIONS.REPORT_BACKFILL_SUMMARY,
    entityType: "system",
    entityId: null,
    metadata: { processed, inserted, skipped, failed },
  });

  if (failed > 0) process.exitCode = 2;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaScript();
  });
