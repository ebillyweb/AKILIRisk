import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/audit/queries", () => ({
  lookupActorDisplay: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { lookupActorDisplay } from "@/lib/audit/queries";
import { getControlCenterActivity } from "./control-center-activity";

const mockFindMany = vi.mocked(prisma.auditLog.findMany);
const mockLookupActor = vi.mocked(lookupActorDisplay);

describe("getControlCenterActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupActor.mockResolvedValue(new Map());
  });

  it("returns null when audit query fails", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));
    const rows = await getControlCenterActivity();
    expect(rows).toBeNull();
  });

  it("maps audit rows to control-center activity items", async () => {
    const createdAt = new Date("2026-05-17T12:00:00Z");
    mockFindMany.mockResolvedValue([
      {
        id: "log_1",
        action: "intake.submit",
        entityType: "IntakeInterview",
        entityId: "intake_abcdef12",
        actorUserId: "user_1",
        actorRole: "USER",
        beforeData: null,
        afterData: { status: "SUBMITTED" },
        createdAt,
      },
    ]);
    mockLookupActor.mockResolvedValue(
      new Map([["user_1", { email: "client@test.com", name: "Test Client" }]])
    );

    const rows = await getControlCenterActivity();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "log_1",
      type: "intake",
      iconKey: "clipboardList",
      title: "Intake submitted",
      user: "Test Client",
    });
    expect(rows[0].description).toContain("IntakeInterview");
    expect(rows[0].description).toContain("created with:");
  });
});
