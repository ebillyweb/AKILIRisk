/**
 * Option D session 2.2 — recordConsentDecision action tests.
 *
 * Coverage:
 *   • unauthenticated → no DB write.
 *   • not_found when assignmentId doesn't exist.
 *   • not_found (opaque) when client mismatches.
 *   • not_active when status != ACTIVE.
 *   • invalid_field for unknown keys.
 *   • Persists visibility map; flips null → concrete.
 *   • One audit row per non-idempotent decision; both YES and NO
 *     audited with metadata.granted distinguishing them.
 *   • Defense-in-depth: advisor-disabled field resolves to false +
 *     no audit row even if client said yes.
 *   • Idempotent revisit (same values as prior) writes no audit rows.
 *   • Omitted field defaults to false ("No, skip" = no).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbState } = vi.hoisted(() => ({
  dbState: {
    sessionUser: null as null | {
      id: string;
      role: string;
      email: string;
    },
    assignment: null as null | {
      id: string;
      clientId: string;
      advisorId: string;
      status: "ACTIVE" | "INACTIVE";
      fieldVisibility: unknown;
      advisor: { piiPolicy: unknown };
    },
    audits: [] as Array<{ action: string; metadata?: unknown }>,
    updates: [] as Array<{ id: string; fieldVisibility: unknown }>,
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () =>
    dbState.sessionUser ? { user: dbState.sessionUser } : null
  ),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return dbState.assignment && dbState.assignment.id === where.id
          ? dbState.assignment
          : null;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { fieldVisibility: unknown };
        }) => {
          dbState.updates.push({
            id: where.id,
            fieldVisibility: data.fieldVisibility,
          });
          if (dbState.assignment && dbState.assignment.id === where.id) {
            dbState.assignment.fieldVisibility = data.fieldVisibility;
          }
          return { id: where.id };
        }
      ),
    },
  },
}));

vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/audit/audit-log")
  >("@/lib/audit/audit-log");
  return {
    ...actual,
    writeAudit: vi.fn(
      async (input: { action: string; metadata?: unknown }) => {
        dbState.audits.push({
          action: input.action,
          metadata: input.metadata,
        });
      }
    ),
  };
});

import { recordConsentDecision } from "./consent-decision-actions";

const ALL_TRUE_POLICY = {
  schemaVersion: 1,
  fields: {
    "User.name": true,
    "ClientProfile.phone": true,
    "HouseholdMember.fullName": true,
    "HouseholdMember.phone": true,
    "HouseholdMember.notes": true,
  },
};

beforeEach(() => {
  dbState.sessionUser = { id: "c-1", role: "USER", email: "c@x.com" };
  dbState.assignment = {
    id: "asn-1",
    clientId: "c-1",
    advisorId: "adv-1",
    status: "ACTIVE",
    fieldVisibility: null,
    advisor: { piiPolicy: ALL_TRUE_POLICY },
  };
  dbState.audits.length = 0;
  dbState.updates.length = 0;
});

describe("recordConsentDecision", () => {
  it("rejects unauthenticated callers", async () => {
    dbState.sessionUser = null;
    const result = await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: { "ClientProfile.phone": true },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unauthenticated");
    expect(dbState.updates).toHaveLength(0);
  });

  it("rejects unknown field keys with invalid_field", async () => {
    const result = await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: { "Unknown.field": true } as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_field");
    expect(dbState.updates).toHaveLength(0);
  });

  it("returns not_found when the assignment doesn't exist", async () => {
    dbState.assignment = null;
    const result = await recordConsentDecision({
      assignmentId: "asn-missing",
      decisions: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("returns not_found (opaque) on cross-client probe", async () => {
    dbState.assignment!.clientId = "c-other";
    const result = await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("returns not_active for INACTIVE assignments", async () => {
    dbState.assignment!.status = "INACTIVE";
    const result = await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_active");
  });

  it("persists visibility map; flips null → concrete", async () => {
    const result = await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: {
        "ClientProfile.phone": true,
        "HouseholdMember.fullName": false,
      },
    });
    expect(result.ok).toBe(true);
    expect(dbState.updates).toHaveLength(1);
    const fv = dbState.updates[0].fieldVisibility as Record<string, boolean>;
    expect(fv["ClientProfile.phone"]).toBe(true);
    expect(fv["HouseholdMember.fullName"]).toBe(false);
    // Omitted fields default to false (treated as "No, skip").
    expect(fv["User.name"]).toBe(false);
    expect(fv["HouseholdMember.phone"]).toBe(false);
    expect(fv["HouseholdMember.notes"]).toBe(false);
  });

  it("audits every non-idempotent decision (YES and NO) with metadata.granted", async () => {
    await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: {
        "ClientProfile.phone": true,
        "HouseholdMember.fullName": false,
      },
    });
    // 5 eligible fields, prior was null → every decision is a flip
    // (5 audit rows total — 1 YES + 4 NO from defaults + the explicit
    // NO for fullName).
    expect(dbState.audits).toHaveLength(5);
    expect(
      dbState.audits.every((a) => a.action === "client_pii.intake_consent")
    ).toBe(true);
    const phoneRow = dbState.audits.find(
      (a) => (a.metadata as { field: string }).field === "ClientProfile.phone"
    );
    expect((phoneRow!.metadata as { granted: boolean }).granted).toBe(true);
    const fullNameRow = dbState.audits.find(
      (a) =>
        (a.metadata as { field: string }).field === "HouseholdMember.fullName"
    );
    expect((fullNameRow!.metadata as { granted: boolean }).granted).toBe(false);
  });

  it("defense-in-depth: advisor-disabled field resolves to false + no audit", async () => {
    dbState.assignment!.advisor.piiPolicy = {
      ...ALL_TRUE_POLICY,
      fields: { ...ALL_TRUE_POLICY.fields, "ClientProfile.phone": false },
    };

    await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: { "ClientProfile.phone": true }, // client says yes
    });

    const fv = dbState.updates[0].fieldVisibility as Record<string, boolean>;
    // The advisor doesn't collect phone → resolves to false regardless.
    expect(fv["ClientProfile.phone"]).toBe(false);
    // And no audit row for that field — the client didn't make a real
    // decision (the prompt didn't surface it).
    const phoneRow = dbState.audits.find(
      (a) => (a.metadata as { field: string }).field === "ClientProfile.phone"
    );
    expect(phoneRow).toBeUndefined();
  });

  it("is idempotent — revisit with same values writes no audit rows", async () => {
    // Seed prior visibility matching the about-to-submit values.
    dbState.assignment!.fieldVisibility = {
      "User.name": false,
      "ClientProfile.phone": true,
      "HouseholdMember.fullName": false,
      "HouseholdMember.phone": false,
      "HouseholdMember.notes": false,
    };
    await recordConsentDecision({
      assignmentId: "asn-1",
      decisions: { "ClientProfile.phone": true },
    });
    expect(dbState.audits).toHaveLength(0);
    // Still wrote the JSON (to surface the same shape; cheap).
    expect(dbState.updates).toHaveLength(1);
  });
});
