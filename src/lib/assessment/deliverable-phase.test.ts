/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase state-machine tests.
 *
 * Each transition helper is verified for:
 *   • idempotency on re-entry (first-entry timestamp preserved)
 *   • a clean no-op when the assessment doesn't exist
 *   • that forward-only transitions don't regress phase when a higher
 *     phase is already current (enterProfile is the load-bearing case;
 *     enterPreview and enterPortfolio are gated by their `*EnteredAt`
 *     short-circuit and never reach the regression branch).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  enterPreview,
  enterProfile,
  enterPortfolio,
  isForwardTransition,
} from "./deliverable-phase";

type Row = {
  id: string;
  deliverablePhase: "PREVIEW" | "PROFILE" | "PORTFOLIO";
  previewEnteredAt: Date | null;
  profileEnteredAt: Date | null;
  portfolioEnteredAt: Date | null;
  upsellTriggersFired: unknown;
};

function makeTx(rows: Row[]) {
  return {
    assessment: {
      findUnique: vi.fn(
        async ({
          where,
          select,
        }: {
          where: { id: string };
          select?: Record<string, true>;
        }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) return null;
          if (!select) return row;
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(select)) out[k] = (row as unknown as Record<string, unknown>)[k];
          return out;
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Row>;
        }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return row;
        }
      ),
    },
  } as unknown as Parameters<typeof enterPreview>[0];
}

describe("isForwardTransition", () => {
  it("treats a null current phase as forward to anything", () => {
    expect(isForwardTransition(null, "PREVIEW")).toBe(true);
    expect(isForwardTransition(undefined, "PORTFOLIO")).toBe(true);
  });
  it("allows PREVIEW → PROFILE → PORTFOLIO", () => {
    expect(isForwardTransition("PREVIEW", "PROFILE")).toBe(true);
    expect(isForwardTransition("PROFILE", "PORTFOLIO")).toBe(true);
  });
  it("rejects backward moves", () => {
    expect(isForwardTransition("PROFILE", "PREVIEW")).toBe(false);
    expect(isForwardTransition("PORTFOLIO", "PROFILE")).toBe(false);
  });
  it("rejects staying in place (not a forward move)", () => {
    expect(isForwardTransition("PROFILE", "PROFILE")).toBe(false);
  });
});

describe("enterPreview", () => {
  let rows: Row[];
  beforeEach(() => {
    rows = [
      {
        id: "asmt-1",
        deliverablePhase: "PREVIEW",
        previewEnteredAt: null,
        profileEnteredAt: null,
        portfolioEnteredAt: null,
        upsellTriggersFired: null,
      },
    ];
  });

  it("stamps previewEnteredAt on first entry", async () => {
    const tx = makeTx(rows);
    const now = new Date("2026-05-26T12:00:00Z");
    await enterPreview(tx, "asmt-1", now);
    expect(rows[0].previewEnteredAt?.toISOString()).toBe(now.toISOString());
    expect(rows[0].deliverablePhase).toBe("PREVIEW");
  });

  it("is idempotent — re-entry preserves the original timestamp", async () => {
    const tx = makeTx(rows);
    const first = new Date("2026-05-26T12:00:00Z");
    const second = new Date("2026-05-27T09:00:00Z");
    await enterPreview(tx, "asmt-1", first);
    await enterPreview(tx, "asmt-1", second);
    expect(rows[0].previewEnteredAt?.toISOString()).toBe(first.toISOString());
  });

  it("is a no-op when the assessment doesn't exist", async () => {
    const tx = makeTx(rows);
    await expect(enterPreview(tx, "missing", new Date())).resolves.toBeUndefined();
    expect(rows[0].previewEnteredAt).toBeNull();
  });
});

describe("enterProfile", () => {
  let rows: Row[];
  beforeEach(() => {
    rows = [
      {
        id: "asmt-1",
        deliverablePhase: "PREVIEW",
        previewEnteredAt: new Date("2026-05-25T10:00:00Z"),
        profileEnteredAt: null,
        portfolioEnteredAt: null,
        upsellTriggersFired: null,
      },
    ];
  });

  it("transitions PREVIEW → PROFILE and stamps profileEnteredAt + triggers", async () => {
    const tx = makeTx(rows);
    const now = new Date("2026-05-26T14:00:00Z");
    await enterProfile(tx, "asmt-1", ["domain_flag:cyber-digital"], now);
    expect(rows[0].deliverablePhase).toBe("PROFILE");
    expect(rows[0].profileEnteredAt?.toISOString()).toBe(now.toISOString());
    expect(rows[0].upsellTriggersFired).toEqual(["domain_flag:cyber-digital"]);
  });

  it("preserves profileEnteredAt across republish but refreshes triggers", async () => {
    const tx = makeTx(rows);
    const first = new Date("2026-05-26T14:00:00Z");
    const second = new Date("2026-05-27T15:00:00Z");
    await enterProfile(tx, "asmt-1", ["kri:q-1"], first);
    await enterProfile(tx, "asmt-1", ["kri:q-1", "kri:q-2"], second);
    expect(rows[0].profileEnteredAt?.toISOString()).toBe(first.toISOString());
    expect(rows[0].upsellTriggersFired).toEqual(["kri:q-1", "kri:q-2"]);
  });

  it("does not regress phase when assessment is already in PORTFOLIO", async () => {
    rows[0].deliverablePhase = "PORTFOLIO";
    rows[0].profileEnteredAt = new Date("2026-05-26T14:00:00Z");
    rows[0].portfolioEnteredAt = new Date("2026-05-27T10:00:00Z");
    const tx = makeTx(rows);
    await enterProfile(tx, "asmt-1", [], new Date());
    expect(rows[0].deliverablePhase).toBe("PORTFOLIO");
  });

  it("is a no-op when the assessment doesn't exist", async () => {
    const tx = makeTx(rows);
    await expect(enterProfile(tx, "missing", [], new Date())).resolves.toBeUndefined();
    expect(rows[0].deliverablePhase).toBe("PREVIEW");
  });
});

describe("enterPortfolio", () => {
  let rows: Row[];
  beforeEach(() => {
    rows = [
      {
        id: "asmt-1",
        deliverablePhase: "PROFILE",
        previewEnteredAt: new Date("2026-05-25T10:00:00Z"),
        profileEnteredAt: new Date("2026-05-26T14:00:00Z"),
        portfolioEnteredAt: null,
        upsellTriggersFired: ["kri:q-1"],
      },
    ];
  });

  it("transitions PROFILE → PORTFOLIO and stamps portfolioEnteredAt", async () => {
    const tx = makeTx(rows);
    const now = new Date("2026-05-27T10:00:00Z");
    await enterPortfolio(tx, "asmt-1", now);
    expect(rows[0].deliverablePhase).toBe("PORTFOLIO");
    expect(rows[0].portfolioEnteredAt?.toISOString()).toBe(now.toISOString());
  });

  it("is idempotent on re-entry — portfolioEnteredAt is preserved", async () => {
    const tx = makeTx(rows);
    const first = new Date("2026-05-27T10:00:00Z");
    const second = new Date("2026-05-28T10:00:00Z");
    await enterPortfolio(tx, "asmt-1", first);
    await enterPortfolio(tx, "asmt-1", second);
    expect(rows[0].portfolioEnteredAt?.toISOString()).toBe(first.toISOString());
  });

  it("is a no-op when the assessment doesn't exist", async () => {
    const tx = makeTx(rows);
    await expect(enterPortfolio(tx, "missing", new Date())).resolves.toBeUndefined();
    expect(rows[0].portfolioEnteredAt).toBeNull();
  });
});
