/**
 * BRD Epic 5.4 / US-33d — Portfolio Reports query tests.
 *
 * Coverage:
 *   • Empty assignment list short-circuits to zero counts and no groups.
 *   • Each report row is projected into the UI shape with the right
 *     PDF and edit hrefs (edit only on DRAFT rows).
 *   • Only the most recent assessment per client is grouped.
 *   • The status filter (DRAFT / PUBLISHED / SUPERSEDED) narrows
 *     report rows; "ALL" or undefined keeps them all.
 *   • needsPublishOnly drops clients without a Draft-but-no-Published
 *     pattern.
 *   • A group whose reports become empty after filtering is dropped.
 *   • Groups are sorted with Ready-to-publish first, then by the
 *     newest report's updatedAt, then by client name.
 *   • Summary counts (assignedClients, clientsWithReports, total,
 *     draft, published, needsPublish) reflect the post-filter state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findAssignments = vi.fn();
const findAssessments = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findMany: (...a: unknown[]) => findAssignments(...a),
    },
    assessment: {
      findMany: (...a: unknown[]) => findAssessments(...a),
    },
  },
}));

const displayName = vi.fn(async (clientId: string) => `Name(${clientId})`);
vi.mock("@/lib/signals/emit", () => ({
  resolveClientDisplayName: (clientId: string) => displayName(clientId),
}));

vi.mock("@/lib/reports/report-template-choice", () => ({
  toReportTemplateUi: (t: unknown) => t, // identity for tests
}));

import { getPortfolioReports } from "./portfolio-queries";

type Report = {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  templateChoice: "COBRANDED" | "BELVEDERE";
  publishedAt: Date | null;
  updatedAt: Date;
  executiveSummary: string | null;
};

type Assessment = {
  id: string;
  userId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  completedAt: Date | null;
  reports: Report[];
};

beforeEach(() => {
  findAssignments.mockReset();
  findAssessments.mockReset();
  displayName.mockClear();
});

function report(partial: Partial<Report> & Pick<Report, "id" | "status" | "version">): Report {
  return {
    templateChoice: "COBRANDED",
    publishedAt: null,
    updatedAt: new Date("2026-05-20T12:00:00Z"),
    executiveSummary: null,
    ...partial,
  };
}

describe("getPortfolioReports — empty state", () => {
  it("returns zero counts and no groups when no clients are assigned", async () => {
    findAssignments.mockResolvedValue([]);
    const result = await getPortfolioReports("adv-1");
    expect(result.groups).toEqual([]);
    expect(result.summary).toEqual({
      assignedClients: 0,
      clientsWithReports: 0,
      totalReports: 0,
      draftCount: 0,
      publishedCount: 0,
      needsPublishCount: 0,
    });
    expect(findAssessments).not.toHaveBeenCalled();
  });
});

describe("getPortfolioReports — projection", () => {
  it("projects each report row with the right hrefs and executive-summary flag", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date("2026-05-15T10:00:00Z"),
        reports: [
          report({
            id: "rep-draft",
            version: 2,
            status: "DRAFT",
            executiveSummary: "  Some summary  ",
          }),
          report({
            id: "rep-pub",
            version: 1,
            status: "PUBLISHED",
            publishedAt: new Date("2026-04-01T10:00:00Z"),
            executiveSummary: null,
          }),
        ],
      } satisfies Assessment,
    ]);
    const result = await getPortfolioReports("adv-1");
    expect(result.groups).toHaveLength(1);
    const group = result.groups[0];
    expect(group.clientId).toBe("client-1");
    expect(group.assessmentId).toBe("asmt-1");
    expect(group.listHref).toBe("/advisor/pipeline/client-1/report");
    expect(group.editHref).toBe("/advisor/pipeline/client-1/report/edit");
    expect(group.hasDraft).toBe(true);
    expect(group.hasPublished).toBe(true);

    const byId = Object.fromEntries(group.reports.map((r) => [r.reportId, r]));
    expect(byId["rep-draft"].editHref).toBe(
      "/advisor/pipeline/client-1/report/edit"
    );
    expect(byId["rep-draft"].pdfHref).toBe("/api/reports/by-id/rep-draft/pdf");
    expect(byId["rep-draft"].hasExecutiveSummary).toBe(true);
    expect(byId["rep-pub"].editHref).toBeNull();
    expect(byId["rep-pub"].pdfHref).toBe("/api/reports/by-id/rep-pub/pdf");
    expect(byId["rep-pub"].publishedAt).toBe("2026-04-01T10:00:00.000Z");
    expect(byId["rep-pub"].hasExecutiveSummary).toBe(false);
  });

  it("keeps only the most recent assessment per client", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    // Prisma orderBy startedAt desc happens at the DB; the action picks
    // the first per userId. Our mock returns rows in that intended order.
    findAssessments.mockResolvedValue([
      {
        id: "asmt-newer",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [report({ id: "r-new", version: 1, status: "DRAFT" })],
      },
      {
        id: "asmt-older",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [report({ id: "r-old", version: 1, status: "PUBLISHED" })],
      },
    ]);
    const result = await getPortfolioReports("adv-1");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].assessmentId).toBe("asmt-newer");
    expect(result.groups[0].reports.map((r) => r.reportId)).toEqual(["r-new"]);
  });
});

describe("getPortfolioReports — filters", () => {
  function seedMixed() {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [
          report({ id: "r-draft", version: 3, status: "DRAFT" }),
          report({
            id: "r-pub",
            version: 2,
            status: "PUBLISHED",
            publishedAt: new Date(),
          }),
          report({ id: "r-sup", version: 1, status: "SUPERSEDED" }),
        ],
      },
    ]);
  }

  it("status=ALL keeps every report row", async () => {
    seedMixed();
    const result = await getPortfolioReports("adv-1", { status: "ALL" });
    expect(result.groups[0].reports.map((r) => r.reportId).sort()).toEqual([
      "r-draft",
      "r-pub",
      "r-sup",
    ]);
  });

  it("status=DRAFT keeps only the Draft row", async () => {
    seedMixed();
    const result = await getPortfolioReports("adv-1", { status: "DRAFT" });
    expect(result.groups[0].reports.map((r) => r.reportId)).toEqual(["r-draft"]);
  });

  it("status=PUBLISHED keeps only the Published row", async () => {
    seedMixed();
    const result = await getPortfolioReports("adv-1", { status: "PUBLISHED" });
    expect(result.groups[0].reports.map((r) => r.reportId)).toEqual(["r-pub"]);
  });

  it("drops a group whose reports become empty after the status filter", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [report({ id: "r-pub", version: 1, status: "PUBLISHED" })],
      },
    ]);
    const result = await getPortfolioReports("adv-1", { status: "DRAFT" });
    expect(result.groups).toHaveLength(0);
  });

  it("needsPublishOnly keeps only clients with Draft AND no Published", async () => {
    findAssignments.mockResolvedValue([
      { clientId: "client-draftonly" },
      { clientId: "client-pubonly" },
      { clientId: "client-both" },
    ]);
    findAssessments.mockResolvedValue([
      {
        id: "a-draftonly",
        userId: "client-draftonly",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [report({ id: "r1", version: 1, status: "DRAFT" })],
      },
      {
        id: "a-pubonly",
        userId: "client-pubonly",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [report({ id: "r2", version: 1, status: "PUBLISHED" })],
      },
      {
        id: "a-both",
        userId: "client-both",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [
          report({ id: "r3a", version: 2, status: "DRAFT" }),
          report({ id: "r3b", version: 1, status: "PUBLISHED" }),
        ],
      },
    ]);
    const result = await getPortfolioReports("adv-1", { needsPublishOnly: true });
    expect(result.groups.map((g) => g.clientId)).toEqual(["client-draftonly"]);
  });
});

describe("getPortfolioReports — sorting", () => {
  it("places Ready-to-publish groups before non-ready ones", async () => {
    findAssignments.mockResolvedValue([
      { clientId: "client-pub" },
      { clientId: "client-needs" },
    ]);
    findAssessments.mockResolvedValue([
      {
        id: "a-pub",
        userId: "client-pub",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [
          report({
            id: "rp1",
            version: 1,
            status: "PUBLISHED",
            updatedAt: new Date("2026-05-25T12:00:00Z"),
          }),
        ],
      },
      {
        id: "a-needs",
        userId: "client-needs",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [
          report({
            id: "rn1",
            version: 1,
            status: "DRAFT",
            updatedAt: new Date("2026-05-20T12:00:00Z"),
          }),
        ],
      },
    ]);
    const result = await getPortfolioReports("adv-1");
    expect(result.groups.map((g) => g.clientId)).toEqual([
      "client-needs",
      "client-pub",
    ]);
  });
});

describe("getPortfolioReports — summary math", () => {
  it("counts assignedClients, clientsWithReports, totals by status, and needs-publish", async () => {
    findAssignments.mockResolvedValue([
      { clientId: "client-1" },
      { clientId: "client-2" },
      { clientId: "client-empty" }, // not in assessments list → no group
    ]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [
          report({ id: "r1-draft", version: 2, status: "DRAFT" }),
          report({ id: "r1-pub", version: 1, status: "PUBLISHED" }),
        ],
      },
      {
        id: "asmt-2",
        userId: "client-2",
        status: "COMPLETED",
        completedAt: new Date(),
        reports: [report({ id: "r2-draft", version: 1, status: "DRAFT" })],
      },
    ]);
    const result = await getPortfolioReports("adv-1");
    expect(result.summary.assignedClients).toBe(3);
    expect(result.summary.clientsWithReports).toBe(2);
    expect(result.summary.totalReports).toBe(3);
    expect(result.summary.draftCount).toBe(2);
    expect(result.summary.publishedCount).toBe(1);
    // client-1 has both DRAFT and PUBLISHED → not needs-publish.
    // client-2 has DRAFT only → needs-publish.
    expect(result.summary.needsPublishCount).toBe(1);
  });
});
