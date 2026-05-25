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
    updates: [] as Array<{ fieldVisibility: unknown }>,
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
      findFirst: vi.fn(async () => dbState.assignment),
      findUnique: vi.fn(async () => dbState.assignment),
      update: vi.fn(
        async ({ data }: { data: { fieldVisibility: unknown } }) => {
          dbState.updates.push({ fieldVisibility: data.fieldVisibility });
          if (dbState.assignment) {
            dbState.assignment.fieldVisibility = data.fieldVisibility;
          }
          return { id: dbState.assignment?.id };
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

import { recordPiiFieldConsent } from "./pii-field-consent-actions";

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
    fieldVisibility: {
      "User.name": false,
      "ClientProfile.phone": false,
      "HouseholdMember.fullName": false,
      "HouseholdMember.phone": false,
      "HouseholdMember.notes": false,
    },
    advisor: { piiPolicy: ALL_TRUE_POLICY },
  };
  dbState.audits.length = 0;
  dbState.updates.length = 0;
});

describe("recordPiiFieldConsent", () => {
  it("sets a single field to true and audits once", async () => {
    const result = await recordPiiFieldConsent({
      field: "ClientProfile.phone",
    });
    expect(result.ok).toBe(true);
    expect(dbState.updates).toHaveLength(1);
    expect(
      (dbState.updates[0].fieldVisibility as Record<string, boolean>)[
        "ClientProfile.phone"
      ]
    ).toBe(true);
    expect(dbState.audits).toHaveLength(1);
    expect(dbState.audits[0].action).toBe("client_pii.field_consent");
    expect(
      (dbState.audits[0].metadata as { granted: boolean }).granted
    ).toBe(true);
  });

  it("is idempotent when the field is already granted", async () => {
    dbState.assignment!.fieldVisibility = {
      ...ALL_TRUE_POLICY.fields,
      "ClientProfile.phone": true,
    };
    const result = await recordPiiFieldConsent({
      field: "ClientProfile.phone",
    });
    expect(result.ok).toBe(true);
    expect(dbState.updates).toHaveLength(0);
    expect(dbState.audits).toHaveLength(0);
  });

  it("rejects when advisor policy disables the field", async () => {
    dbState.assignment!.advisor.piiPolicy = {
      ...ALL_TRUE_POLICY,
      fields: { ...ALL_TRUE_POLICY.fields, "User.name": false },
    };
    const result = await recordPiiFieldConsent({ field: "User.name" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("policy_disabled");
  });
});
