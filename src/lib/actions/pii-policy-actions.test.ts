/**
 * Option D session 1 commit 1.3 (BRD §5.1 amendment) — updatePiiPolicy
 * action tests.
 *
 * Coverage:
 *   • persists changes (PII_POLICY_UPDATE summary + per-field rows).
 *   • emits PII_POLICY_FIELD_ENABLE for each false→true flip.
 *   • emits PII_POLICY_FIELD_DISABLE for each true→false flip.
 *   • idempotent: a no-change submit writes nothing + returns updated=0.
 *   • validation: rejects unknown field keys with `invalid_field`.
 *   • role: rejects non-advisor callers with `forbidden`.
 *   • partial submission: omitted fields retain their current value.
 *   • per-field counts in the audit summary metadata.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbState, fakes } = vi.hoisted(() => {
  const state = {
    advisorPiiPolicy: {
      schemaVersion: 1,
      pseudonymousWorkspaceLabeling: false,
      fields: {
        "User.name": true,
        "ClientProfile.phone": true,
        "HouseholdMember.fullName": true,
        "HouseholdMember.phone": true,
        "HouseholdMember.notes": true,
      },
    } as Record<string, unknown>,
    advisorProfileId: "adv-1",
    advisorUserId: "user-advisor",
    advisorEmail: "advisor@x.com",
    advisorRole: "ADVISOR" as "ADVISOR" | "ADMIN" | "USER",
    auditWrites: [] as Array<{
      action: string;
      metadata?: unknown;
      beforeData?: unknown;
      afterData?: unknown;
    }>,
    advisorUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  };
  return {
    dbState: state,
    fakes: { ses: state },
  };
});

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: vi.fn(async () => {
    if (
      dbState.advisorRole !== "ADVISOR" &&
      dbState.advisorRole !== "ADMIN"
    ) {
      throw new Error("Unauthorized: Advisor access required");
    }
    return {
      userId: dbState.advisorUserId,
      role: dbState.advisorRole,
      email: dbState.advisorEmail,
    };
  }),
  getAdvisorProfileOrThrow: vi.fn(async () => ({
    id: dbState.advisorProfileId,
    userId: dbState.advisorUserId,
    piiPolicy: dbState.advisorPiiPolicy,
    user: { email: dbState.advisorEmail },
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorProfile: {
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          dbState.advisorUpdates.push({ id: where.id, data });
          if (data.piiPolicy) {
            dbState.advisorPiiPolicy = data.piiPolicy as Record<string, unknown>;
          }
          return { id: where.id };
        }
      ),
    },
  },
}));

vi.mock("@/lib/audit/audit-log", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/audit/audit-log")>(
      "@/lib/audit/audit-log"
    );
  return {
    ...actual,
    writeAudit: vi.fn(
      async (input: {
        action: string;
        metadata?: unknown;
        beforeData?: unknown;
        afterData?: unknown;
      }) => {
        dbState.auditWrites.push({
          action: input.action,
          metadata: input.metadata,
          beforeData: input.beforeData,
          afterData: input.afterData,
        });
      }
    ),
  };
});

// The action consults the enterprise client-data policy to decide whether the
// firm locks any fields. These tests cover the non-enterprise (unlocked) path,
// so stub the context to a not-locked result. Mocking at this boundary avoids
// pulling in resolveBillingContext + its prisma reads.
vi.mock("@/lib/enterprise/enterprise-client-data-policy", () => ({
  getAdvisorClientDataPolicyContext: vi.fn(async () => ({
    enterprisePolicy: null,
    memberRole: null,
    advisorPolicy: dbState.advisorPiiPolicy,
    effective: {
      pseudonymousWorkspaceLabeling:
        (dbState.advisorPiiPolicy as { pseudonymousWorkspaceLabeling: boolean })
          .pseudonymousWorkspaceLabeling,
      fields: (dbState.advisorPiiPolicy as { fields: Record<string, boolean> })
        .fields,
      lockedByEnterprise: false,
    },
  })),
}));

import { updatePiiPolicy } from "./pii-policy-actions";

beforeEach(() => {
  dbState.advisorPiiPolicy = {
    schemaVersion: 1,
    pseudonymousWorkspaceLabeling: false,
    fields: {
      "User.name": true,
      "ClientProfile.phone": true,
      "HouseholdMember.fullName": true,
      "HouseholdMember.phone": true,
      "HouseholdMember.notes": true,
    },
  };
  dbState.advisorRole = "ADVISOR";
  dbState.auditWrites.length = 0;
  dbState.advisorUpdates.length = 0;
});

describe("updatePiiPolicy", () => {
  it("persists a single false→true flip and emits the right audit rows", async () => {
    // Start with one field disabled, then re-enable it.
    (dbState.advisorPiiPolicy as { fields: Record<string, boolean> }).fields[
      "ClientProfile.phone"
    ] = false;

    const result = await updatePiiPolicy({
      fields: { "ClientProfile.phone": true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(1);

    // DB write happened.
    expect(dbState.advisorUpdates).toHaveLength(1);
    expect(
      (dbState.advisorUpdates[0].data.piiPolicy as { fields: Record<string, boolean> })
        .fields["ClientProfile.phone"]
    ).toBe(true);

    // Audit: one ENABLE row + one summary row.
    const enableRows = dbState.auditWrites.filter(
      (w) => w.action === "pii_policy.field_enable"
    );
    const summaryRows = dbState.auditWrites.filter(
      (w) => w.action === "pii_policy.update"
    );
    expect(enableRows).toHaveLength(1);
    expect(summaryRows).toHaveLength(1);
    expect((enableRows[0].metadata as { field: string }).field).toBe(
      "ClientProfile.phone"
    );
    expect(
      (summaryRows[0].metadata as { changedFieldCount: number })
        .changedFieldCount
    ).toBe(1);
  });

  it("emits PII_POLICY_FIELD_DISABLE on a true→false flip", async () => {
    const result = await updatePiiPolicy({
      fields: { "HouseholdMember.notes": false },
    });
    expect(result.ok).toBe(true);
    const disableRows = dbState.auditWrites.filter(
      (w) => w.action === "pii_policy.field_disable"
    );
    expect(disableRows).toHaveLength(1);
    expect((disableRows[0].metadata as { field: string }).field).toBe(
      "HouseholdMember.notes"
    );
  });

  it("emits one ENABLE + one DISABLE row when two fields flip in opposite directions", async () => {
    (dbState.advisorPiiPolicy as { fields: Record<string, boolean> }).fields[
      "User.name"
    ] = false;

    const result = await updatePiiPolicy({
      fields: {
        "User.name": true,
        "HouseholdMember.notes": false,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(2);
    expect(
      dbState.auditWrites.filter((w) => w.action === "pii_policy.field_enable")
    ).toHaveLength(1);
    expect(
      dbState.auditWrites.filter((w) => w.action === "pii_policy.field_disable")
    ).toHaveLength(1);
    expect(
      dbState.auditWrites.filter((w) => w.action === "pii_policy.update")
    ).toHaveLength(1);
  });

  it("is idempotent: a no-change submit writes nothing + returns updated=0", async () => {
    // Submit a value that matches what's already in the policy.
    const result = await updatePiiPolicy({
      fields: { "User.name": true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(0);
    expect(dbState.advisorUpdates).toHaveLength(0); // no DB write
    expect(dbState.auditWrites).toHaveLength(0); // no audit rows
  });

  it("rejects unknown field keys with invalid_field (no DB write, no audit)", async () => {
    const result = await updatePiiPolicy({
      fields: { "Unknown.field": true } as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_field");
    expect(dbState.advisorUpdates).toHaveLength(0);
    expect(dbState.auditWrites).toHaveLength(0);
  });

  it("rejects ADMIN-role callers acting outside the advisor portal with forbidden", async () => {
    dbState.advisorRole = "ADMIN";

    const result = await updatePiiPolicy({
      fields: { "User.name": false },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden");
  });

  it("retains current value for fields omitted from the input", async () => {
    // Start with one field disabled.
    (dbState.advisorPiiPolicy as { fields: Record<string, boolean> }).fields[
      "HouseholdMember.phone"
    ] = false;

    // Submit a flip on a DIFFERENT field; the omitted one stays disabled.
    const result = await updatePiiPolicy({
      fields: { "User.name": false },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.policy.fields["HouseholdMember.phone"]).toBe(false);
    expect(result.data.policy.fields["User.name"]).toBe(false);
    // The other untouched fields stay true.
    expect(result.data.policy.fields["ClientProfile.phone"]).toBe(true);
  });

  it("captures the full before/after policy in the summary audit row", async () => {
    await updatePiiPolicy({ fields: { "User.name": false } });

    const summary = dbState.auditWrites.find(
      (w) => w.action === "pii_policy.update"
    );
    expect(summary).toBeTruthy();
    expect(summary!.beforeData).toMatchObject({
      schemaVersion: 1,
      fields: { "User.name": true },
    });
    expect(summary!.afterData).toMatchObject({
      schemaVersion: 1,
      fields: { "User.name": false },
    });
  });

  it("persists pseudonymous workspace labeling independently of intake fields", async () => {
    const result = await updatePiiPolicy({
      pseudonymousWorkspaceLabeling: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(1);
    expect(result.data.policy.pseudonymousWorkspaceLabeling).toBe(true);
    expect(result.data.policy.fields["User.name"]).toBe(true);
  });
});
