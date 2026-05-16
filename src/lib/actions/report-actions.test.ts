/**
 * §4.5 commit 3 (BRD §4.5) — Report lifecycle action tests.
 *
 * Coverage:
 *   • publishReport: snapshot populated, prior PUBLISHED → SUPERSEDED,
 *     new DRAFT opened at v+1, audit row written, P2002 surfaces as
 *     concurrent_publish.
 *   • publishReport: forbids non-assigned advisor; admin OK.
 *   • republishReport: admin-only (rejects advisor + client callers);
 *     requires reason; inherits editorial from prior PUBLISHED;
 *     rejects when no prior publish exists.
 *   • saveDraftEdits: max-length validation; rejects non-DRAFT.
 *   • getOrCreateDraft: idempotent (existing DRAFT returned); v+1 on
 *     fresh create.
 *
 * The mock uses a single in-memory `dbState` object that every prisma
 * fake reads from / writes to. `$transaction` just invokes the callback
 * with the same fake — good enough for unit tests since we're not
 * exercising real isolation. For concurrent-publish coverage we
 * directly throw a P2002 from one of the writes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted state shared by all fakes.
const { dbState, fakes } = vi.hoisted(() => {
  const state = {
    nextId: 0,
    reports: [] as Array<{
      id: string;
      assessmentId: string;
      version: number;
      status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
      templateChoice: "BELVEDERE" | "COBRANDED";
      executiveSummary: string | null;
      advisorNotes: unknown;
      snapshotData: unknown;
      brandingSnapshot: unknown;
      publishedAt: Date | null;
      publishedById: string | null;
    }>,
    assessments: [] as Array<{ id: string; userId: string }>,
    advisors: [] as Array<{ userId: string; advisorProfileId: string }>,
    assignments: [] as Array<{
      advisorId: string;
      clientId: string;
      status: "ACTIVE" | "INACTIVE";
    }>,
    auditWrites: [] as Array<{ action: string; metadata: unknown; entityId: string | null }>,
    /** When true, the next report.create({status:'DRAFT'}) throws P2002. */
    failNextDraftCreateWithP2002: false,
  };

  const session = { userId: "user-advisor", role: "ADVISOR", email: "advisor@x.com" };

  const makeId = (): string => {
    state.nextId += 1;
    return `gen-${state.nextId}`;
  };

  const reportApi = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return state.reports.find((r) => r.id === where.id) ?? null;
    }),
    findFirst: vi.fn(
      async ({
        where,
        orderBy,
      }: {
        where: { assessmentId: string; status?: "DRAFT" | "PUBLISHED" | "SUPERSEDED" };
        orderBy?: { version?: "desc" } | { publishedAt?: "desc" };
      }) => {
        let rows = state.reports.filter((r) => r.assessmentId === where.assessmentId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy && "version" in orderBy) {
          rows = [...rows].sort((a, b) => b.version - a.version);
        } else if (orderBy && "publishedAt" in orderBy) {
          rows = [...rows].sort(
            (a, b) =>
              (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
          );
        }
        return rows[0] ?? null;
      }
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (state.failNextDraftCreateWithP2002 && data.status === "DRAFT") {
        state.failNextDraftCreateWithP2002 = false;
        const err = new Error("Unique constraint failed");
        // Mirror Prisma's PrismaClientKnownRequestError shape enough for
        // `instanceof Prisma.PrismaClientKnownRequestError` to match. The
        // action's instanceof check is keyed on the class import; we
        // override the prototype check below.
        (err as { code?: string }).code = "P2002";
        Object.setPrototypeOf(err, FAKE_PRISMA_KNOWN_ERROR_PROTO);
        throw err;
      }
      const row = {
        id: makeId(),
        assessmentId: data.assessmentId as string,
        version: data.version as number,
        status: (data.status ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "SUPERSEDED",
        templateChoice: (data.templateChoice ?? "COBRANDED") as
          | "BELVEDERE"
          | "COBRANDED",
        executiveSummary: (data.executiveSummary ?? null) as string | null,
        advisorNotes: data.advisorNotes ?? null,
        snapshotData: data.snapshotData ?? null,
        brandingSnapshot: data.brandingSnapshot ?? null,
        publishedAt: (data.publishedAt ?? null) as Date | null,
        publishedById: (data.publishedById ?? null) as string | null,
      };
      state.reports.push(row);
      return { id: row.id, version: row.version };
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = state.reports.find((r) => r.id === where.id);
        if (!row) throw new Error("not_found");
        Object.assign(row, data);
        return { id: row.id, version: row.version };
      }
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          assessmentId: string;
          status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
        };
        data: Record<string, unknown>;
      }) => {
        const rows = state.reports.filter(
          (r) => r.assessmentId === where.assessmentId && r.status === where.status
        );
        for (const r of rows) Object.assign(r, data);
        return { count: rows.length };
      }
    ),
  };

  const FAKE_PRISMA_KNOWN_ERROR_PROTO: object = {};

  return {
    dbState: state,
    fakes: { reportApi, session, FAKE_PRISMA_KNOWN_ERROR_PROTO, makeId },
  };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: fakes.session.userId, role: fakes.session.role, email: fakes.session.email },
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return dbState.assessments.find((a) => a.id === where.id) ?? null;
      }),
    },
    advisorProfile: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
        const found = dbState.advisors.find((a) => a.userId === where.userId);
        return found ? { id: found.advisorProfileId } : null;
      }),
    },
    clientAdvisorAssignment: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { advisorId: string; clientId: string; status: string };
        }) => {
          const found = dbState.assignments.find(
            (a) =>
              a.advisorId === where.advisorId &&
              a.clientId === where.clientId &&
              a.status === where.status
          );
          return found ? { id: "assn-1" } : null;
        }
      ),
    },
    report: fakes.reportApi,
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Pass the same prisma object as the tx argument.
      return cb({
        report: fakes.reportApi,
      });
    }),
  },
}));

vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/audit/audit-log")
  >("@/lib/audit/audit-log");
  return {
    ...actual,
    writeAudit: vi.fn(async (input: { action: string; metadata?: unknown; entityId?: string | null }) => {
      dbState.auditWrites.push({
        action: input.action,
        metadata: input.metadata,
        entityId: input.entityId ?? null,
      });
    }),
  };
});

vi.mock("@/lib/pdf/build-report-snapshot", () => ({
  buildReportSnapshot: vi.fn(async (assessmentId: string) => ({
    schemaVersion: 1 as const,
    pillar: "cyber-digital",
    reportData: {
      score: 7.0,
      riskLevel: "medium",
      breakdown: [],
      missingControls: [],
      assessmentDate: "March 4, 2026",
      completionPercentage: 100,
      categoryCount: 0,
      missingControlsCount: 0,
      pillarScores: [],
    },
    householdProfile: null,
    _testTag: `snapshot-of-${assessmentId}`,
  })),
  buildBrandingSnapshot: vi.fn(async () => ({
    brandName: "Test Firm",
    advisorFirmName: "Test Firm",
    brandingEnabled: true,
    customDomainEnabled: false,
  })),
}));

// Substitute Prisma's PrismaClientKnownRequestError with a class whose
// `instanceof` matches the proto we set on injected errors above. Lets
// the action's `err instanceof Prisma.PrismaClientKnownRequestError`
// check fire correctly in tests without pulling Prisma's runtime in.
vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>(
    "@prisma/client"
  );
  class FakeKnownErr extends Error {
    code?: string;
  }
  Object.setPrototypeOf(
    fakes.FAKE_PRISMA_KNOWN_ERROR_PROTO,
    FakeKnownErr.prototype
  );
  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      PrismaClientKnownRequestError: FakeKnownErr,
      JsonNull: actual.Prisma.JsonNull,
    },
  };
});

import {
  getOrCreateDraft,
  saveDraftEdits,
  publishReport,
  republishReport,
} from "./report-actions";

beforeEach(() => {
  dbState.nextId = 0;
  dbState.reports.length = 0;
  dbState.assessments.length = 0;
  dbState.advisors.length = 0;
  dbState.assignments.length = 0;
  dbState.auditWrites.length = 0;
  dbState.failNextDraftCreateWithP2002 = false;
  fakes.session.userId = "user-advisor";
  fakes.session.role = "ADVISOR";
  fakes.session.email = "advisor@x.com";
});

function seedAssignedAdvisor(): void {
  dbState.assessments.push({ id: "asmt-1", userId: "client-1" });
  dbState.advisors.push({ userId: "user-advisor", advisorProfileId: "adv-1" });
  dbState.assignments.push({
    advisorId: "adv-1",
    clientId: "client-1",
    status: "ACTIVE",
  });
}

describe("getOrCreateDraft", () => {
  it("creates a v=1 DRAFT when no Report rows exist", async () => {
    seedAssignedAdvisor();

    const result = await getOrCreateDraft("asmt-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(1);
    expect(dbState.reports).toHaveLength(1);
    expect(dbState.reports[0].status).toBe("DRAFT");
  });

  it("returns the existing DRAFT instead of creating a duplicate", async () => {
    seedAssignedAdvisor();
    dbState.reports.push({
      id: "existing-draft",
      assessmentId: "asmt-1",
      version: 5,
      status: "DRAFT",
      templateChoice: "COBRANDED",
      executiveSummary: null,
      advisorNotes: null,
      snapshotData: null,
      brandingSnapshot: null,
      publishedAt: null,
      publishedById: null,
    });

    const result = await getOrCreateDraft("asmt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reportId).toBe("existing-draft");
    expect(result.data.version).toBe(5);
    expect(dbState.reports).toHaveLength(1); // no new row
  });

  it("creates the next DRAFT at version+1 when prior PUBLISHED exists", async () => {
    seedAssignedAdvisor();
    dbState.reports.push({
      id: "v1",
      assessmentId: "asmt-1",
      version: 1,
      status: "PUBLISHED",
      templateChoice: "COBRANDED",
      executiveSummary: null,
      advisorNotes: null,
      snapshotData: { x: 1 },
      brandingSnapshot: null,
      publishedAt: new Date(),
      publishedById: "user-advisor",
    });

    const result = await getOrCreateDraft("asmt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(2);
  });

  it("forbids advisors with no ACTIVE assignment", async () => {
    dbState.assessments.push({ id: "asmt-1", userId: "client-1" });
    // No advisor profile / no assignment seeded.

    const result = await getOrCreateDraft("asmt-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden");
  });
});

describe("saveDraftEdits", () => {
  beforeEach(() => {
    seedAssignedAdvisor();
    dbState.reports.push({
      id: "draft-1",
      assessmentId: "asmt-1",
      version: 1,
      status: "DRAFT",
      templateChoice: "COBRANDED",
      executiveSummary: null,
      advisorNotes: null,
      snapshotData: null,
      brandingSnapshot: null,
      publishedAt: null,
      publishedById: null,
    });
  });

  it("persists executiveSummary + advisorNotes + templateChoice", async () => {
    const result = await saveDraftEdits({
      reportId: "draft-1",
      executiveSummary: "All looking good.",
      advisorNotes: { "rec-1": "Discuss next quarter." },
      templateChoice: "BELVEDERE",
    });
    expect(result.ok).toBe(true);
    const row = dbState.reports.find((r) => r.id === "draft-1");
    expect(row?.executiveSummary).toBe("All looking good.");
    expect(row?.advisorNotes).toEqual({ "rec-1": "Discuss next quarter." });
    expect(row?.templateChoice).toBe("BELVEDERE");
  });

  it("rejects executive summaries over 2000 chars", async () => {
    const tooLong = "x".repeat(2001);
    const result = await saveDraftEdits({
      reportId: "draft-1",
      executiveSummary: tooLong,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("executive_summary_too_long");
  });

  it("rejects per-recommendation notes over 1000 chars", async () => {
    const tooLong = "x".repeat(1001);
    const result = await saveDraftEdits({
      reportId: "draft-1",
      advisorNotes: { "rec-x": tooLong },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("advisor_note_too_long");
  });

  it("rejects edits to a non-DRAFT report", async () => {
    dbState.reports.find((r) => r.id === "draft-1")!.status = "PUBLISHED";
    const result = await saveDraftEdits({
      reportId: "draft-1",
      executiveSummary: "x",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_draft");
  });
});

describe("publishReport", () => {
  beforeEach(() => {
    seedAssignedAdvisor();
    dbState.reports.push({
      id: "draft-1",
      assessmentId: "asmt-1",
      version: 1,
      status: "DRAFT",
      templateChoice: "COBRANDED",
      executiveSummary: "Summary v1",
      advisorNotes: { "rec-1": "Note" },
      snapshotData: null,
      brandingSnapshot: null,
      publishedAt: null,
      publishedById: null,
    });
  });

  it("flips DRAFT → PUBLISHED, populates snapshotData, opens v+1 DRAFT, writes audit", async () => {
    const result = await publishReport("draft-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const published = dbState.reports.find((r) => r.id === "draft-1");
    expect(published?.status).toBe("PUBLISHED");
    expect(published?.snapshotData).toMatchObject({
      schemaVersion: 1,
      _testTag: "snapshot-of-asmt-1",
    });
    expect(published?.brandingSnapshot).toMatchObject({
      brandName: "Test Firm",
    });
    expect(published?.publishedAt).toBeInstanceOf(Date);
    expect(published?.publishedById).toBe("user-advisor");

    const newDraft = dbState.reports.find(
      (r) => r.assessmentId === "asmt-1" && r.status === "DRAFT"
    );
    expect(newDraft?.version).toBe(2);
    expect(newDraft?.executiveSummary).toBe("Summary v1"); // inherited

    expect(dbState.auditWrites).toHaveLength(1);
    expect(dbState.auditWrites[0].action).toBe("report.publish");
    expect(dbState.auditWrites[0].entityId).toBe("draft-1");
  });

  it("supersedes any prior PUBLISHED row for the same assessment", async () => {
    dbState.reports.push({
      id: "v1-published",
      assessmentId: "asmt-1",
      version: 0, // Already published before draft-1 was created (synthetic).
      status: "PUBLISHED",
      templateChoice: "COBRANDED",
      executiveSummary: "Old summary",
      advisorNotes: null,
      snapshotData: { x: 1 },
      brandingSnapshot: null,
      publishedAt: new Date("2026-01-01"),
      publishedById: "user-advisor",
    });

    const result = await publishReport("draft-1");
    expect(result.ok).toBe(true);

    const old = dbState.reports.find((r) => r.id === "v1-published");
    expect(old?.status).toBe("SUPERSEDED");
  });

  it("forbids non-assigned advisor", async () => {
    // Drop the assignment.
    dbState.assignments.length = 0;

    const result = await publishReport("draft-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden");
  });

  it("allows admin caller without assignment", async () => {
    dbState.assignments.length = 0;
    fakes.session.role = "ADMIN";

    const result = await publishReport("draft-1");
    expect(result.ok).toBe(true);
  });

  it("surfaces concurrent publish as a structured concurrent_publish error", async () => {
    dbState.failNextDraftCreateWithP2002 = true;

    const result = await publishReport("draft-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("concurrent_publish");
  });

  it("rejects publish on a non-DRAFT report", async () => {
    dbState.reports.find((r) => r.id === "draft-1")!.status = "PUBLISHED";

    const result = await publishReport("draft-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_draft");
  });
});

describe("republishReport", () => {
  beforeEach(() => {
    seedAssignedAdvisor();
    dbState.reports.push({
      id: "v1-published",
      assessmentId: "asmt-1",
      version: 1,
      status: "PUBLISHED",
      templateChoice: "COBRANDED",
      executiveSummary: "Original summary",
      advisorNotes: { "rec-1": "Original note" },
      snapshotData: { old: true },
      brandingSnapshot: null,
      publishedAt: new Date("2026-01-01"),
      publishedById: "user-advisor",
    });
  });

  it("rejects non-admin callers", async () => {
    fakes.session.role = "ADVISOR";

    const result = await republishReport({
      assessmentId: "asmt-1",
      reason: "fix bug",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden");
  });

  it("allows SUPER_ADMIN callers", async () => {
    fakes.session.role = "SUPER_ADMIN";

    const result = await republishReport({
      assessmentId: "asmt-1",
      reason: "platform correction",
    });
    expect(result.ok).toBe(true);
  });

  it("requires a reason", async () => {
    fakes.session.role = "ADMIN";

    const result = await republishReport({
      assessmentId: "asmt-1",
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("reason_required");
  });

  it("rejects reason >500 chars", async () => {
    fakes.session.role = "ADMIN";

    const result = await republishReport({
      assessmentId: "asmt-1",
      reason: "x".repeat(501),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("reason_too_long");
  });

  it("inherits editorial from prior PUBLISHED + supersedes old + writes audit", async () => {
    fakes.session.role = "ADMIN";

    const result = await republishReport({
      assessmentId: "asmt-1",
      reason: "Scoring rule v2 fixed mfa weighting bug",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const old = dbState.reports.find((r) => r.id === "v1-published");
    expect(old?.status).toBe("SUPERSEDED");

    const newPub = dbState.reports.find(
      (r) => r.id !== "v1-published" && r.status === "PUBLISHED"
    );
    expect(newPub?.executiveSummary).toBe("Original summary");
    expect(newPub?.advisorNotes).toEqual({ "rec-1": "Original note" });
    expect(newPub?.version).toBe(2);

    expect(dbState.auditWrites).toHaveLength(1);
    expect(dbState.auditWrites[0].action).toBe("report.republish");
    expect(
      (dbState.auditWrites[0].metadata as { reason: string }).reason
    ).toBe("Scoring rule v2 fixed mfa weighting bug");
  });

  it("rejects when no prior PUBLISHED exists", async () => {
    dbState.reports.length = 0;
    fakes.session.role = "ADMIN";

    const result = await republishReport({
      assessmentId: "asmt-1",
      reason: "premature",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("no_prior_publish");
  });
});
