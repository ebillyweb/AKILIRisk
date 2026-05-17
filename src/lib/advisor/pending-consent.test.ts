/**
 * Option D session 2.2 — pending-consent helper tests.
 *
 * Coverage:
 *   • Empty list when no ACTIVE assignments have null fieldVisibility.
 *   • Returns assignments with null fieldVisibility + advisor policy.
 *   • Excludes assignments with non-null fieldVisibility (already
 *     consented).
 *   • Excludes assignments whose status is not ACTIVE.
 *   • hasPendingConsent boolean shape (true / false).
 */

import { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbState } = vi.hoisted(() => ({
  dbState: {
    rows: [] as Array<{
      id: string;
      clientId: string;
      advisorId: string;
      status: "ACTIVE" | "INACTIVE";
      fieldVisibility: unknown;
      advisor: { firmName: string | null; piiPolicy: unknown };
    }>,
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            clientId: string;
            status: string;
            fieldVisibility: { equals: typeof Prisma.DbNull };
          };
        }) => {
          return dbState.rows
            .filter(
              (r) =>
                r.clientId === where.clientId &&
                r.status === where.status &&
                r.fieldVisibility === null &&
                where.fieldVisibility.equals === Prisma.DbNull
            )
            .map((r) => ({
              id: r.id,
              advisorId: r.advisorId,
              advisor: r.advisor,
            }));
        }
      ),
      count: vi.fn(
        async ({
          where,
        }: {
          where: {
            clientId: string;
            status: string;
            fieldVisibility: { equals: typeof Prisma.DbNull };
          };
        }) => {
          return dbState.rows.filter(
            (r) =>
              r.clientId === where.clientId &&
              r.status === where.status &&
              r.fieldVisibility === null &&
              where.fieldVisibility.equals === Prisma.DbNull
          ).length;
        }
      ),
    },
  },
}));

import {
  listAssignmentsAwaitingConsent,
  hasPendingConsent,
} from "./pending-consent";

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
  dbState.rows.length = 0;
});

describe("listAssignmentsAwaitingConsent", () => {
  it("returns [] when no assignments need consent", async () => {
    dbState.rows.push({
      id: "asn-1",
      clientId: "c-1",
      advisorId: "adv-1",
      status: "ACTIVE",
      fieldVisibility: { ...ALL_TRUE_POLICY.fields }, // non-null → consented
      advisor: { firmName: "Firm A", piiPolicy: ALL_TRUE_POLICY },
    });
    expect(await listAssignmentsAwaitingConsent("c-1")).toEqual([]);
  });

  it("returns assignments whose fieldVisibility is null + advisor policy", async () => {
    dbState.rows.push({
      id: "asn-1",
      clientId: "c-1",
      advisorId: "adv-1",
      status: "ACTIVE",
      fieldVisibility: null,
      advisor: { firmName: "Firm A", piiPolicy: ALL_TRUE_POLICY },
    });
    const result = await listAssignmentsAwaitingConsent("c-1");
    expect(result).toHaveLength(1);
    expect(result[0].assignmentId).toBe("asn-1");
    expect(result[0].firmName).toBe("Firm A");
    expect(result[0].advisorPolicy.fields["ClientProfile.phone"]).toBe(true);
  });

  it("excludes INACTIVE assignments even with null fieldVisibility", async () => {
    dbState.rows.push({
      id: "asn-1",
      clientId: "c-1",
      advisorId: "adv-1",
      status: "INACTIVE",
      fieldVisibility: null,
      advisor: { firmName: "Firm A", piiPolicy: ALL_TRUE_POLICY },
    });
    expect(await listAssignmentsAwaitingConsent("c-1")).toEqual([]);
  });

  it("scopes by clientId — other clients' pending assignments are not returned", async () => {
    dbState.rows.push(
      {
        id: "asn-1",
        clientId: "c-other",
        advisorId: "adv-1",
        status: "ACTIVE",
        fieldVisibility: null,
        advisor: { firmName: "Firm A", piiPolicy: ALL_TRUE_POLICY },
      },
      {
        id: "asn-2",
        clientId: "c-1",
        advisorId: "adv-1",
        status: "ACTIVE",
        fieldVisibility: null,
        advisor: { firmName: "Firm A", piiPolicy: ALL_TRUE_POLICY },
      }
    );
    const result = await listAssignmentsAwaitingConsent("c-1");
    expect(result.map((r) => r.assignmentId)).toEqual(["asn-2"]);
  });
});

describe("hasPendingConsent", () => {
  it("returns false when count is 0", async () => {
    expect(await hasPendingConsent("c-1")).toBe(false);
  });

  it("returns true when at least one pending row exists", async () => {
    dbState.rows.push({
      id: "asn-1",
      clientId: "c-1",
      advisorId: "adv-1",
      status: "ACTIVE",
      fieldVisibility: null,
      advisor: { firmName: "Firm A", piiPolicy: ALL_TRUE_POLICY },
    });
    expect(await hasPendingConsent("c-1")).toBe(true);
  });
});
