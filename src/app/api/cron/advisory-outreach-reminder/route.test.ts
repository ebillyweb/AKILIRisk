/**
 * BRD §6.3 / Epic 5.10 US-71 — Advisory-outreach-reminder cron tests.
 *
 * Coverage:
 *   • Missing Authorization header → 401.
 *   • Wrong bearer secret → 401 (timing-safe path).
 *   • Valid secret, no candidates → 200 with assessmentsConsidered: 0.
 *   • Valid secret, candidates present → triggers fire and the count
 *     comes back in the response body.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const triggerSpy = vi.fn();
vi.mock("@/lib/notifications/deliverable-phase-triggers", () => ({
  triggerAdvisoryOutreachReminder: (...args: unknown[]) => triggerSpy(...args),
}));

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { assessment: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

import { GET } from "./route";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/advisory-outreach-reminder", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  triggerSpy.mockReset();
  findMany.mockReset();
  process.env.CRON_SECRET = "supersecret-32-bytes-long-string-x";
});

describe("GET /api/cron/advisory-outreach-reminder", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer secret is wrong", async () => {
    const res = await GET(
      makeRequest({ Authorization: "Bearer not-the-secret" }) as unknown as Parameters<typeof GET>[0]
    );
    expect(res.status).toBe(401);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(
      makeRequest({ Authorization: "Bearer anything" }) as unknown as Parameters<typeof GET>[0]
    );
    expect(res.status).toBe(500);
  });

  it("returns 200 with 0 candidates when no assessments qualify", async () => {
    findMany.mockResolvedValue([]);
    const res = await GET(
      makeRequest({
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      }) as unknown as Parameters<typeof GET>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assessmentsConsidered).toBe(0);
    expect(body.remindersAttempted).toBe(0);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("fires the trigger once per candidate and reports the count", async () => {
    findMany.mockResolvedValue([
      { id: "asmt-1" },
      { id: "asmt-2" },
      { id: "asmt-3" },
    ]);
    const res = await GET(
      makeRequest({
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      }) as unknown as Parameters<typeof GET>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assessmentsConsidered).toBe(3);
    expect(body.remindersAttempted).toBe(3);
    expect(triggerSpy).toHaveBeenCalledTimes(3);
    expect(triggerSpy.mock.calls.map((c) => c[0])).toEqual([
      "asmt-1",
      "asmt-2",
      "asmt-3",
    ]);
  });

  it("queries for PREVIEW assessments past the 44h threshold", async () => {
    findMany.mockResolvedValue([]);
    await GET(
      makeRequest({
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      }) as unknown as Parameters<typeof GET>[0]
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where.deliverablePhase).toBe("PREVIEW");
    expect(args.where.previewEnteredAt).toMatchObject({ not: null });
    expect(args.where.previewEnteredAt.lte).toBeInstanceOf(Date);
    // Threshold should be ≥ 44 hours in the past (give a small tolerance).
    const fortyFourHoursMs = 44 * 60 * 60 * 1000;
    const delta = Date.now() - args.where.previewEnteredAt.lte.getTime();
    expect(delta).toBeGreaterThanOrEqual(fortyFourHoursMs - 1000);
    expect(delta).toBeLessThan(fortyFourHoursMs + 60_000);
  });
});
