/**
 * BRD Epic 5.4 / US-29e — Signal emission tests.
 *
 * Coverage:
 *   • emitAssessmentSignals fans out to every active advisor for the
 *     client and is a no-op when no advisor is assigned.
 *   • Pillar transitions emit PILLAR_CRITICAL / PILLAR_MODERATE on
 *     first-time scoring and on transitions into a worse band; healthy
 *     scores produce no pillar signal.
 *   • A SCORE_DECLINED signal fires when the maturity drop meets the
 *     0.5 threshold (SCORE_DECLINE_THRESHOLD) and not before.
 *   • UPSELL_TRIGGER signals fire for new trigger codes only (already-
 *     present codes are skipped) and the severity is derived from the
 *     code namespace: domain_flag / kri = critical; score_threshold =
 *     moderate.
 *   • Lifecycle signals (ASSESSMENT_COMPLETED / ASSESSMENT_RESCORED)
 *     are scoped to the matching event; the pillar_scored event emits
 *     no lifecycle signal.
 *   • Persistence swallows the P2002 unique-constraint failure (the
 *     dedupe path) without aborting the rest of the batch.
 *   • emitReportPublishedSignal writes one REPORT_PUBLISHED signal per
 *     assigned advisor with the expected dedupe key.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { SCORE_DECLINE_THRESHOLD } from "@/lib/signals/types";
import { getSeverity } from "@/lib/intelligence/queries";

// Constant + boundary sanity that the rest of the suite relies on.
describe("signals MVP rules", () => {
  it("uses a 0.5 point decline threshold", () => {
    expect(SCORE_DECLINE_THRESHOLD).toBe(0.5);
  });
  it("maps scores to critical at or below 3.0", () => {
    expect(getSeverity(3.0)).toBe("critical");
    expect(getSeverity(3.1)).toBe("moderate");
  });
});

const createSignal = vi.fn();
const findAssignments = vi.fn();
const findUser = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    advisorSignal: { create: (...args: unknown[]) => createSignal(...args) },
    clientAdvisorAssignment: {
      findMany: (...args: unknown[]) => findAssignments(...args),
    },
    user: { findUnique: (...args: unknown[]) => findUser(...args) },
  },
}));

vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: (ct: string) => `decrypted:${ct}`,
}));

// CATEGORY_LABELS only affects display strings; a minimal map keeps the
// test assertions readable.
vi.mock("@/lib/analytics/formatters", () => ({
  CATEGORY_LABELS: { "cyber-digital": "Cyber", governance: "Governance" } as Record<
    string,
    string
  >,
}));

import {
  emitAssessmentSignals,
  emitReportPublishedSignal,
} from "./emit";

const clientUser = {
  emailCiphertext: "cipher-client",
  name: "Alex",
  firstName: null,
  lastName: null,
};

beforeEach(() => {
  createSignal.mockReset();
  findAssignments.mockReset();
  findUser.mockReset();
  // Default: one active assignment to advisor "adv-1".
  findAssignments.mockResolvedValue([{ advisorId: "adv-1" }]);
  findUser.mockResolvedValue(clientUser);
  createSignal.mockResolvedValue({});
});

function callsBy(type: string) {
  return createSignal.mock.calls
    .map((c) => c[0].data)
    .filter((d) => d.type === type);
}

describe("emitAssessmentSignals — no advisors", () => {
  it("is a no-op when no advisor is actively assigned", async () => {
    findAssignments.mockResolvedValue([]);
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "completed",
      beforeScores: null,
      afterScores: [{ pillar: "governance", score: 2.0, riskLevel: "CRITICAL" }],
    });
    expect(createSignal).not.toHaveBeenCalled();
  });
});

describe("emitAssessmentSignals — pillar transitions", () => {
  it("emits PILLAR_CRITICAL when a freshly-scored pillar is critical", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [{ pillar: "cyber-digital", score: 2.5, riskLevel: "CRITICAL" }],
    });
    const critical = callsBy("PILLAR_CRITICAL");
    expect(critical).toHaveLength(1);
    expect(critical[0].severity).toBe("critical");
    expect(critical[0].dedupeKey).toBe("asmt-1:critical:cyber-digital");
    expect(critical[0].payload.scoreAfter).toBe(2.5);
  });

  it("emits PILLAR_MODERATE when a freshly-scored pillar is moderate", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [{ pillar: "governance", score: 4.5, riskLevel: "HIGH" }],
    });
    const moderate = callsBy("PILLAR_MODERATE");
    expect(moderate).toHaveLength(1);
    expect(moderate[0].severity).toBe("moderate");
    expect(moderate[0].dedupeKey).toBe("asmt-1:moderate:governance");
  });

  it("emits no pillar signal when the score is healthy (low severity)", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [{ pillar: "governance", score: 8.0, riskLevel: "LOW" }],
    });
    expect(callsBy("PILLAR_CRITICAL")).toHaveLength(0);
    expect(callsBy("PILLAR_MODERATE")).toHaveLength(0);
  });

  it("emits PILLAR_CRITICAL only on transition into critical (not when already there)", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 2,
      event: "rescored",
      beforeScores: [{ pillar: "cyber-digital", score: 2.8, riskLevel: "CRITICAL" }],
      afterScores: [{ pillar: "cyber-digital", score: 2.6, riskLevel: "CRITICAL" }],
    });
    expect(callsBy("PILLAR_CRITICAL")).toHaveLength(0);
  });

  it("emits PILLAR_CRITICAL when a pillar transitions moderate → critical", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 2,
      event: "rescored",
      beforeScores: [{ pillar: "cyber-digital", score: 4.2, riskLevel: "HIGH" }],
      afterScores: [{ pillar: "cyber-digital", score: 2.5, riskLevel: "CRITICAL" }],
    });
    expect(callsBy("PILLAR_CRITICAL")).toHaveLength(1);
  });

  it("emits PILLAR_MODERATE only when transitioning from healthy into moderate", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 2,
      event: "rescored",
      beforeScores: [{ pillar: "governance", score: 8.0, riskLevel: "LOW" }],
      afterScores: [{ pillar: "governance", score: 4.5, riskLevel: "HIGH" }],
    });
    expect(callsBy("PILLAR_MODERATE")).toHaveLength(1);
  });
});

describe("emitAssessmentSignals — SCORE_DECLINED threshold", () => {
  it("emits SCORE_DECLINED when the maturity drop meets the 0.5 threshold", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 2,
      event: "rescored",
      beforeScores: [{ pillar: "governance", score: 6.5, riskLevel: "LOW" }],
      afterScores: [{ pillar: "governance", score: 6.0, riskLevel: "LOW" }],
    });
    const declined = callsBy("SCORE_DECLINED");
    expect(declined).toHaveLength(1);
    expect(declined[0].payload.scoreBefore).toBe(6.5);
    expect(declined[0].payload.scoreAfter).toBe(6.0);
    expect(declined[0].dedupeKey).toBe("asmt-1:decline:governance:v2");
  });

  it("does not emit SCORE_DECLINED when the drop is below the threshold", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 2,
      event: "rescored",
      beforeScores: [{ pillar: "governance", score: 6.3, riskLevel: "LOW" }],
      afterScores: [{ pillar: "governance", score: 6.0, riskLevel: "LOW" }],
    });
    expect(callsBy("SCORE_DECLINED")).toHaveLength(0);
  });
});

describe("emitAssessmentSignals — upsell triggers", () => {
  it("fires UPSELL_TRIGGER for new codes and skips ones present before", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [],
      upsellTriggersBefore: ["score_threshold:overall"],
      upsellTriggersAfter: ["score_threshold:overall", "kri:q-1"],
    });
    const upsell = callsBy("UPSELL_TRIGGER");
    expect(upsell).toHaveLength(1);
    expect(upsell[0].payload.triggerCode).toBe("kri:q-1");
  });

  it("derives Critical severity for domain_flag and kri trigger codes", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [],
      upsellTriggersAfter: ["domain_flag:cyber-digital", "kri:q-1"],
    });
    const upsell = callsBy("UPSELL_TRIGGER");
    expect(upsell).toHaveLength(2);
    for (const s of upsell) expect(s.severity).toBe("critical");
  });

  it("derives Moderate severity for score_threshold trigger codes", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [],
      upsellTriggersAfter: ["score_threshold:overall"],
    });
    const upsell = callsBy("UPSELL_TRIGGER");
    expect(upsell).toHaveLength(1);
    expect(upsell[0].severity).toBe("moderate");
  });
});

describe("emitAssessmentSignals — lifecycle events", () => {
  it("emits ASSESSMENT_COMPLETED on event=completed", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "completed",
      beforeScores: null,
      afterScores: [],
    });
    expect(callsBy("ASSESSMENT_COMPLETED")).toHaveLength(1);
    expect(callsBy("ASSESSMENT_RESCORED")).toHaveLength(0);
  });

  it("emits ASSESSMENT_RESCORED on event=rescored", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 2,
      event: "rescored",
      beforeScores: null,
      afterScores: [],
    });
    expect(callsBy("ASSESSMENT_RESCORED")).toHaveLength(1);
    expect(callsBy("ASSESSMENT_COMPLETED")).toHaveLength(0);
  });

  it("emits no lifecycle signal for event=pillar_scored", async () => {
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "pillar_scored",
      beforeScores: null,
      afterScores: [],
    });
    expect(callsBy("ASSESSMENT_COMPLETED")).toHaveLength(0);
    expect(callsBy("ASSESSMENT_RESCORED")).toHaveLength(0);
  });
});

describe("emitAssessmentSignals — persistence", () => {
  it("swallows a P2002 unique-constraint failure and continues with the rest", async () => {
    createSignal
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }))
      .mockResolvedValue({});
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "completed",
      beforeScores: null,
      afterScores: [{ pillar: "cyber-digital", score: 2.5, riskLevel: "CRITICAL" }],
    });
    // Pillar signal hit P2002 → swallowed; lifecycle signal still attempted.
    expect(createSignal).toHaveBeenCalledTimes(2);
  });

  it("fans signals out to each active advisor for the client", async () => {
    findAssignments.mockResolvedValue([
      { advisorId: "adv-1" },
      { advisorId: "adv-2" },
    ]);
    await emitAssessmentSignals({
      clientId: "client-1",
      assessmentId: "asmt-1",
      version: 1,
      event: "completed",
      beforeScores: null,
      afterScores: [],
    });
    const advisors = createSignal.mock.calls.map((c) => c[0].data.advisorId);
    expect(advisors).toEqual(expect.arrayContaining(["adv-1", "adv-2"]));
  });
});

describe("emitReportPublishedSignal", () => {
  it("writes one REPORT_PUBLISHED signal per assigned advisor", async () => {
    findAssignments.mockResolvedValue([
      { advisorId: "adv-1" },
      { advisorId: "adv-2" },
    ]);
    await emitReportPublishedSignal({
      clientId: "client-1",
      assessmentId: "asmt-1",
      reportId: "rep-1",
      version: 3,
    });
    const published = callsBy("REPORT_PUBLISHED");
    expect(published).toHaveLength(2);
    expect(published[0].dedupeKey).toBe("rep-1:published");
    expect(published[0].payload.reportId).toBe("rep-1");
    expect(published[0].payload.assessmentVersion).toBe(3);
  });

  it("is a no-op when no advisor is assigned", async () => {
    findAssignments.mockResolvedValue([]);
    await emitReportPublishedSignal({
      clientId: "client-1",
      assessmentId: "asmt-1",
      reportId: "rep-1",
      version: 1,
    });
    expect(createSignal).not.toHaveBeenCalled();
  });
});
