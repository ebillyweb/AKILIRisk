/**
 * BRD §6.3 / Epic 5.10 — Portfolio engagement server-action tests.
 *
 * Coverage:
 *   • acceptRecommendation: auth, ownership, phase gate, missing advisor,
 *     happy path creates engagement + transitions phase + writes audit,
 *     idempotent on duplicate accept, race on unique index (P2002) is
 *     handled by returning the existing engagement.
 *   • updateEngagementStatus: advisor-only, only the assigned advisor can
 *     act, allowed-transition table is enforced both for legal moves and
 *     for forbidden moves, completedAt / declinedAt are stamped on
 *     terminal transitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const authSpy = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => authSpy() }));

const writeAuditSpy = vi.fn();
vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>(
    "@/lib/audit/audit-log"
  );
  return {
    ...actual,
    writeAudit: (...args: unknown[]) => writeAuditSpy(...args),
  };
});

const acceptedTriggerSpy = vi.fn();
const meetingTriggerSpy = vi.fn();
vi.mock("@/lib/notifications/deliverable-phase-triggers", () => ({
  triggerEngagementAccepted: (...args: unknown[]) => acceptedTriggerSpy(...args),
  triggerMeetingScheduled: (...args: unknown[]) => meetingTriggerSpy(...args),
}));

const enterPortfolioSpy = vi.fn();
vi.mock("@/lib/assessment/deliverable-phase", () => ({
  enterPortfolio: (...args: unknown[]) => enterPortfolioSpy(...args),
}));

type Engagement = {
  id: string;
  assessmentId: string;
  clientId: string;
  advisorId: string;
  status: "ACCEPTED" | "MEETING_SCHEDULED" | "IN_PROGRESS" | "COMPLETE" | "DECLINED";
  meetingScheduledAt: Date | null;
  meetingAt: Date | null;
  completedAt: Date | null;
  declinedAt: Date | null;
  notes: string | null;
  acceptedAt: Date;
};

type Assessment = {
  id: string;
  userId: string;
  deliverablePhase: "PREVIEW" | "PROFILE" | "PORTFOLIO";
  portfolioEngagement: Engagement | null;
};

const dbState = {
  assessments: [] as Assessment[],
  engagements: [] as Engagement[],
  /** Active assignment lookup keyed by clientId. */
  assignments: [] as Array<{
    clientId: string;
    status: "ACTIVE" | "INACTIVE";
    advisor: { userId: string };
  }>,
  /** When true the next portfolioEngagement.create rejects with P2002. */
  failNextCreateP2002: false,
  /** When true the same call also leaves an existing row to be discovered. */
  raceLeavesExistingRow: false,
  nextId: 0,
};

function makeId() {
  dbState.nextId += 1;
  return `eng-${dbState.nextId}`;
}

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => {
          const row = dbState.assessments.find((a) => a.id === where.id);
          if (!row) return null;
          return {
            id: row.id,
            userId: row.userId,
            deliverablePhase: row.deliverablePhase,
            portfolioEngagement: row.portfolioEngagement
              ? { id: row.portfolioEngagement.id }
              : null,
          };
        }
      ),
    },
    clientAdvisorAssignment: {
      findFirst: vi.fn(
        async ({ where }: { where: { clientId: string; status: string } }) => {
          const a = dbState.assignments.find(
            (x) => x.clientId === where.clientId && x.status === where.status
          );
          return a ? { advisor: { userId: a.advisor.userId } } : null;
        }
      ),
    },
    portfolioEngagement: {
      create: vi.fn(
        async ({ data }: { data: Omit<Engagement, "id"> }) => {
          if (dbState.failNextCreateP2002) {
            dbState.failNextCreateP2002 = false;
            if (dbState.raceLeavesExistingRow) {
              const row = {
                id: makeId(),
                ...data,
                status: data.status ?? "ACCEPTED",
                meetingScheduledAt: data.meetingScheduledAt ?? null,
                meetingAt: data.meetingAt ?? null,
                completedAt: data.completedAt ?? null,
                declinedAt: data.declinedAt ?? null,
                notes: data.notes ?? null,
              } as Engagement;
              dbState.engagements.push(row);
              // attach to assessment
              const asmt = dbState.assessments.find((a) => a.id === data.assessmentId);
              if (asmt) asmt.portfolioEngagement = row;
            }
            throw new Prisma.PrismaClientKnownRequestError("dup", {
              code: "P2002",
              clientVersion: "test",
            });
          }
          const row: Engagement = {
            id: makeId(),
            ...data,
            status: data.status ?? "ACCEPTED",
            meetingScheduledAt: data.meetingScheduledAt ?? null,
            meetingAt: data.meetingAt ?? null,
            completedAt: data.completedAt ?? null,
            declinedAt: data.declinedAt ?? null,
            notes: data.notes ?? null,
          } as Engagement;
          dbState.engagements.push(row);
          const asmt = dbState.assessments.find((a) => a.id === data.assessmentId);
          if (asmt) asmt.portfolioEngagement = row;
          return { id: row.id };
        }
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id?: string; assessmentId?: string } }) => {
          if (where.id) return dbState.engagements.find((e) => e.id === where.id) ?? null;
          if (where.assessmentId)
            return dbState.engagements.find((e) => e.assessmentId === where.assessmentId) ?? null;
          return null;
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Engagement>;
        }) => {
          const row = dbState.engagements.find((e) => e.id === where.id);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return row;
        }
      ),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({
      assessment: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const row = dbState.assessments.find((a) => a.id === where.id);
          if (!row) return null;
          return {
            deliverablePhase: row.deliverablePhase,
            portfolioEnteredAt: null,
          };
        },
        update: async () => undefined,
      },
      portfolioEngagement: {
        create: async ({ data }: { data: Omit<Engagement, "id"> }) => {
          if (dbState.failNextCreateP2002) {
            dbState.failNextCreateP2002 = false;
            if (dbState.raceLeavesExistingRow) {
              const row = {
                id: makeId(),
                ...data,
                status: data.status ?? "ACCEPTED",
                meetingScheduledAt: data.meetingScheduledAt ?? null,
                meetingAt: data.meetingAt ?? null,
                completedAt: data.completedAt ?? null,
                declinedAt: data.declinedAt ?? null,
                notes: data.notes ?? null,
              } as Engagement;
              dbState.engagements.push(row);
              const asmt = dbState.assessments.find((a) => a.id === data.assessmentId);
              if (asmt) asmt.portfolioEngagement = row;
            }
            throw new Prisma.PrismaClientKnownRequestError("dup", {
              code: "P2002",
              clientVersion: "test",
            });
          }
          const row: Engagement = {
            id: makeId(),
            ...data,
            status: data.status ?? "ACCEPTED",
            meetingScheduledAt: data.meetingScheduledAt ?? null,
            meetingAt: data.meetingAt ?? null,
            completedAt: data.completedAt ?? null,
            declinedAt: data.declinedAt ?? null,
            notes: data.notes ?? null,
          } as Engagement;
          dbState.engagements.push(row);
          const asmt = dbState.assessments.find((a) => a.id === data.assessmentId);
          if (asmt) asmt.portfolioEngagement = row;
          return { id: row.id };
        },
      },
    })),
  },
}));

import {
  acceptRecommendation,
  updateEngagementStatus,
} from "./portfolio-engagement-actions";

const client = {
  user: { id: "client-1", role: "USER", email: "c@x.com" },
};
const advisor = {
  user: { id: "advisor-1", role: "ADVISOR", email: "a@x.com" },
};

beforeEach(() => {
  authSpy.mockReset();
  writeAuditSpy.mockClear();
  acceptedTriggerSpy.mockClear();
  meetingTriggerSpy.mockClear();
  enterPortfolioSpy.mockClear();
  dbState.assessments = [];
  dbState.engagements = [];
  dbState.assignments = [];
  dbState.failNextCreateP2002 = false;
  dbState.raceLeavesExistingRow = false;
  dbState.nextId = 0;
});

function seedProfileAssessment() {
  dbState.assessments.push({
    id: "asmt-1",
    userId: "client-1",
    deliverablePhase: "PROFILE",
    portfolioEngagement: null,
  });
  dbState.assignments.push({
    clientId: "client-1",
    status: "ACTIVE",
    advisor: { userId: "advisor-1" },
  });
}

describe("acceptRecommendation", () => {
  it("refuses an unauthenticated request", async () => {
    authSpy.mockResolvedValue(null);
    const r = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(r).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("returns not_found for an unknown assessment", async () => {
    authSpy.mockResolvedValue(client);
    const r = await acceptRecommendation({ assessmentId: "missing" });
    expect(r).toEqual({ ok: false, code: "not_found" });
  });

  it("refuses when the caller does not own the assessment", async () => {
    authSpy.mockResolvedValue({ user: { id: "someone-else", role: "USER" } });
    seedProfileAssessment();
    const r = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(r).toEqual({ ok: false, code: "forbidden" });
  });

  it("refuses when the assessment is still in PREVIEW phase", async () => {
    authSpy.mockResolvedValue(client);
    seedProfileAssessment();
    dbState.assessments[0].deliverablePhase = "PREVIEW";
    const r = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(r).toEqual({ ok: false, code: "wrong_phase" });
  });

  it("refuses when no active advisor is assigned", async () => {
    authSpy.mockResolvedValue(client);
    seedProfileAssessment();
    dbState.assignments = [];
    const r = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(r).toEqual({ ok: false, code: "no_advisor" });
  });

  it("creates the engagement, transitions phase, fires trigger, and audits", async () => {
    authSpy.mockResolvedValue(client);
    seedProfileAssessment();
    const r = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.alreadyExisted).toBe(false);
    expect(dbState.engagements).toHaveLength(1);
    expect(dbState.engagements[0].advisorId).toBe("advisor-1");
    expect(enterPortfolioSpy).toHaveBeenCalledTimes(1);
    expect(acceptedTriggerSpy).toHaveBeenCalledWith(r.engagementId);
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      "portfolio_engagement.accept"
    );
  });

  it("is idempotent — a second accept returns the existing engagement", async () => {
    authSpy.mockResolvedValue(client);
    seedProfileAssessment();
    const first = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(first.ok).toBe(true);
    const second = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error();
    expect(second.alreadyExisted).toBe(true);
    expect(dbState.engagements).toHaveLength(1);
  });

  it("recovers from a concurrent-accept race (P2002 → return existing)", async () => {
    authSpy.mockResolvedValue(client);
    seedProfileAssessment();
    dbState.failNextCreateP2002 = true;
    dbState.raceLeavesExistingRow = true;
    const r = await acceptRecommendation({ assessmentId: "asmt-1" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.alreadyExisted).toBe(true);
    expect(dbState.engagements).toHaveLength(1);
  });
});

describe("updateEngagementStatus", () => {
  function seedEngagement(status: Engagement["status"]) {
    dbState.engagements.push({
      id: "eng-100",
      assessmentId: "asmt-1",
      clientId: "client-1",
      advisorId: "advisor-1",
      status,
      meetingScheduledAt: null,
      meetingAt: null,
      completedAt: null,
      declinedAt: null,
      notes: null,
      acceptedAt: new Date(),
    });
  }

  it("refuses an unauthenticated caller", async () => {
    authSpy.mockResolvedValue(null);
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "IN_PROGRESS",
    });
    expect(r).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("refuses a client (non-advisor / non-admin) caller", async () => {
    authSpy.mockResolvedValue(client);
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "IN_PROGRESS",
    });
    expect(r).toEqual({ ok: false, code: "forbidden" });
  });

  it("returns not_found for an unknown engagement", async () => {
    authSpy.mockResolvedValue(advisor);
    const r = await updateEngagementStatus({
      engagementId: "missing",
      status: "IN_PROGRESS",
    });
    expect(r).toEqual({ ok: false, code: "not_found" });
  });

  it("refuses an advisor who is not assigned to this engagement", async () => {
    authSpy.mockResolvedValue({ user: { id: "advisor-other", role: "ADVISOR" } });
    seedEngagement("ACCEPTED");
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "IN_PROGRESS",
    });
    expect(r).toEqual({ ok: false, code: "forbidden" });
  });

  it("allows ACCEPTED → MEETING_SCHEDULED and stamps meeting fields + fires trigger", async () => {
    authSpy.mockResolvedValue(advisor);
    seedEngagement("ACCEPTED");
    const meeting = new Date("2026-06-10T15:00:00Z");
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "MEETING_SCHEDULED",
      meetingScheduledAt: new Date("2026-05-30T10:00:00Z"),
      meetingAt: meeting,
    });
    expect(r).toEqual({ ok: true });
    expect(dbState.engagements[0].status).toBe("MEETING_SCHEDULED");
    expect(dbState.engagements[0].meetingAt?.toISOString()).toBe(meeting.toISOString());
    expect(meetingTriggerSpy).toHaveBeenCalledWith("eng-100");
  });

  it("allows IN_PROGRESS → COMPLETE and stamps completedAt", async () => {
    authSpy.mockResolvedValue(advisor);
    seedEngagement("IN_PROGRESS");
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "COMPLETE",
    });
    expect(r).toEqual({ ok: true });
    expect(dbState.engagements[0].completedAt).not.toBeNull();
    expect(meetingTriggerSpy).not.toHaveBeenCalled();
  });

  it("stamps declinedAt on a DECLINED transition", async () => {
    authSpy.mockResolvedValue(advisor);
    seedEngagement("MEETING_SCHEDULED");
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "DECLINED",
    });
    expect(r).toEqual({ ok: true });
    expect(dbState.engagements[0].declinedAt).not.toBeNull();
  });

  it("refuses an illegal transition (COMPLETE → IN_PROGRESS)", async () => {
    authSpy.mockResolvedValue(advisor);
    seedEngagement("COMPLETE");
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "IN_PROGRESS",
    });
    expect(r).toEqual({ ok: false, code: "invalid_status" });
  });

  it("refuses skipping a step (ACCEPTED → COMPLETE)", async () => {
    authSpy.mockResolvedValue(advisor);
    seedEngagement("ACCEPTED");
    const r = await updateEngagementStatus({
      engagementId: "eng-100",
      status: "COMPLETE",
    });
    expect(r).toEqual({ ok: false, code: "invalid_status" });
  });

  it("writes the status_update audit row on a successful transition", async () => {
    authSpy.mockResolvedValue(advisor);
    seedEngagement("ACCEPTED");
    await updateEngagementStatus({
      engagementId: "eng-100",
      status: "IN_PROGRESS",
    });
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const call = writeAuditSpy.mock.calls[0][0];
    expect(call.action).toBe("portfolio_engagement.status_update");
    expect(call.beforeData).toEqual({ status: "ACCEPTED" });
    expect(call.afterData).toEqual({ status: "IN_PROGRESS" });
  });
});
