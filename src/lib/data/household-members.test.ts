/**
 * Round-11 cleanup (NIT 2) — concurrent createHouseholdMemberRecord
 * race test.
 *
 * Two concurrent creates for the same userId both compute "Member A"
 * from the read at nextDisplayLabelForUser. With the new
 * `@@unique([userId, displayLabel])` constraint added in migration
 * 20260520120000, the second writer's prisma.householdMember.create
 * throws Prisma's P2002 unique-violation. The retry loop in
 * createHouseholdMemberRecord catches that, recomputes the next label
 * (now "Member B" because the first writer landed), and tries again.
 *
 * This test simulates the real DB behaviour by:
 *   - Backing the mock with a Set<string> tracking inserted labels
 *     for the userId.
 *   - prisma.householdMember.findMany returns rows for whatever labels
 *     are currently in the Set.
 *   - prisma.householdMember.create either inserts (new label) or
 *     throws { code: "P2002" } when the (userId, label) pair already
 *     exists — exactly what the DB unique index would do.
 *
 * Then we Promise.all two creates. Both should resolve, and the two
 * resulting labels must be DISTINCT — proof that the retry loop
 * recovered from the race.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaSpies, insertedLabels } = vi.hoisted(() => {
  const inserted = new Map<string, Set<string>>(); // userId -> set of displayLabels
  return {
    insertedLabels: inserted,
    prismaSpies: {
      householdMember: {
        findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
          const labels = inserted.get(where.userId) ?? new Set<string>();
          return Array.from(labels).map((displayLabel, i) => ({
            id: `m-${where.userId}-${i}`,
            userId: where.userId,
            displayLabel,
          }));
        }),
        create: vi.fn(
          async ({
            data,
          }: {
            data: { userId: string; displayLabel: string };
          }) => {
            const existing = inserted.get(data.userId) ?? new Set<string>();
            if (existing.has(data.displayLabel)) {
              // Mirror Prisma's P2002 unique-violation shape.
              const err = new Error(
                "Unique constraint failed on the fields: (`userId`,`displayLabel`)",
              ) as Error & { code: string };
              err.code = "P2002";
              throw err;
            }
            existing.add(data.displayLabel);
            inserted.set(data.userId, existing);
            return {
              id: `m-${data.userId}-${existing.size}`,
              userId: data.userId,
              displayLabel: data.displayLabel,
              birthYear: null,
              sex: null,
              relationship: "OTHER",
              governanceRoles: [],
              isResident: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        ),
      },
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { createHouseholdMemberRecord } from "./household-members";

beforeEach(() => {
  insertedLabels.clear();
  prismaSpies.householdMember.findMany.mockClear();
  prismaSpies.householdMember.create.mockClear();
});

describe("createHouseholdMemberRecord race resilience (NIT 2)", () => {
  it("two concurrent creates for the same userId produce distinct labels", async () => {
    const [a, b] = await Promise.all([
      createHouseholdMemberRecord("u-race", { relationship: "SPOUSE" } as never),
      createHouseholdMemberRecord("u-race", { relationship: "CHILD" } as never),
    ]);

    expect(a.displayLabel).not.toBe(b.displayLabel);
    expect([a.displayLabel, b.displayLabel].sort()).toEqual([
      "Member A",
      "Member B",
    ]);
  });

  it("retries on P2002, succeeding once a free label is available", async () => {
    // Pre-seed Member A so the first read returns Member B as the
    // computed next label. A concurrent insert collides on "Member B".
    insertedLabels.set("u-pre", new Set(["Member A"]));

    // Force a single P2002 on the first attempt by inserting "Member B"
    // between the read and the create. Achieved via spy that only
    // collides once.
    const realCreate = prismaSpies.householdMember.create
      .getMockImplementation()!;
    let collidedOnce = false;
    prismaSpies.householdMember.create.mockImplementationOnce(async (args) => {
      if (!collidedOnce) {
        collidedOnce = true;
        // Simulate the concurrent writer: insert what the caller
        // intended ("Member B"), then throw P2002 for the caller.
        const inner = insertedLabels.get(args.data.userId) ?? new Set<string>();
        inner.add(args.data.displayLabel);
        insertedLabels.set(args.data.userId, inner);
        const err = new Error("Unique constraint failed") as Error & {
          code: string;
        };
        err.code = "P2002";
        throw err;
      }
      return realCreate(args);
    });

    const out = await createHouseholdMemberRecord("u-pre", {
      relationship: "PARENT",
    } as never);
    // First attempt collided on "Member B"; the retry computes "Member C".
    expect(out.displayLabel).toBe("Member C");
    expect(prismaSpies.householdMember.create).toHaveBeenCalledTimes(2);
  });

  it("propagates non-P2002 errors immediately without retrying", async () => {
    prismaSpies.householdMember.create.mockImplementationOnce(async () => {
      const err = new Error("connection refused") as Error & { code: string };
      err.code = "P1001";
      throw err;
    });

    await expect(
      createHouseholdMemberRecord("u-err", { relationship: "OTHER" } as never),
    ).rejects.toMatchObject({ code: "P1001" });
    expect(prismaSpies.householdMember.create).toHaveBeenCalledTimes(1);
  });
});
