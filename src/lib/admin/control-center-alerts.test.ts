import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: { count: vi.fn(), findFirst: vi.fn() },
    intakeApproval: { count: vi.fn(), findFirst: vi.fn() },
    stripeWebhookEvent: { findMany: vi.fn() },
    governanceReviewLead: { count: vi.fn(), findFirst: vi.fn() },
    intakeInterview: { count: vi.fn(), findFirst: vi.fn() },
    user: { findMany: vi.fn() },
    subscription: { count: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getControlCenterAlerts } from "./control-center-alerts";

const mockAssessmentCount = vi.mocked(prisma.assessment.count);
const mockAssessmentFindFirst = vi.mocked(prisma.assessment.findFirst);
const mockIntakeApprovalCount = vi.mocked(prisma.intakeApproval.count);
const mockIntakeApprovalFindFirst = vi.mocked(prisma.intakeApproval.findFirst);
const mockStripeFindMany = vi.mocked(prisma.stripeWebhookEvent.findMany);
const mockLeadCount = vi.mocked(prisma.governanceReviewLead.count);
const mockLeadFindFirst = vi.mocked(prisma.governanceReviewLead.findFirst);
const mockIntakeCount = vi.mocked(prisma.intakeInterview.count);
const mockIntakeFindFirst = vi.mocked(prisma.intakeInterview.findFirst);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockSubscriptionCount = vi.mocked(prisma.subscription.count);
const mockSubscriptionFindFirst = vi.mocked(prisma.subscription.findFirst);

describe("getControlCenterAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssessmentCount.mockResolvedValue(0);
    mockAssessmentFindFirst.mockResolvedValue(null);
    mockIntakeApprovalCount.mockResolvedValue(0);
    mockIntakeApprovalFindFirst.mockResolvedValue(null);
    mockStripeFindMany.mockResolvedValue([]);
    mockLeadCount.mockResolvedValue(0);
    mockLeadFindFirst.mockResolvedValue(null);
    mockIntakeCount.mockResolvedValue(0);
    mockIntakeFindFirst.mockResolvedValue(null);
    mockUserFindMany.mockResolvedValue([]);
    mockSubscriptionCount.mockResolvedValue(0);
    mockSubscriptionFindFirst.mockResolvedValue(null);
  });

  it("returns empty list when nothing needs attention", async () => {
    const alerts = await getControlCenterAlerts();
    expect(alerts).toEqual([]);
  });

  it("builds stalled assessment and integration alerts sorted by severity", async () => {
    const stalledAt = new Date("2026-05-10T12:00:00Z");
    const webhookAt = new Date("2026-05-17T10:00:00Z");

    mockAssessmentCount.mockResolvedValue(3);
    mockAssessmentFindFirst.mockResolvedValue({
      updatedAt: stalledAt,
    } as Awaited<ReturnType<typeof prisma.assessment.findFirst>>);
    mockStripeFindMany.mockResolvedValue([
      {
        id: "wh_1",
        receivedAt: webhookAt,
        eventType: "invoice.payment_failed",
        status: "FAILED",
        eventCreated: webhookAt,
        processedAt: null,
      },
    ] as Awaited<ReturnType<typeof prisma.stripeWebhookEvent.findMany>>);

    const alerts = await getControlCenterAlerts();

    expect(alerts).toHaveLength(2);
    expect(alerts[0].id).toBe("failed-integrations");
    expect(alerts[0].severity).toBe("high");
    expect(alerts[1].id).toBe("stalled-assessments");
    expect(alerts[1].title).toBe("3 Assessments Stalled");
    expect(alerts[1].href).toBe("/admin/assessment");
  });

  it("does not flag enterprise members covered by an active firm subscription", async () => {
    // Active member of an active firm with a valid firm subscription, no personal
    // subscription and no personal firmName — must NOT count as incomplete.
    mockUserFindMany.mockResolvedValue([
      {
        updatedAt: new Date("2026-05-01T12:00:00Z"),
        advisorProfile: { firmName: null },
        subscription: null,
        enterpriseMembership: {
          status: "ACTIVE",
          enterprise: {
            status: "ACTIVE",
            subscription: { status: "ACTIVE" },
          },
        },
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);

    const alerts = await getControlCenterAlerts();

    expect(
      alerts.find((a) => a.id === "incomplete-advisor-onboarding")
    ).toBeUndefined();
  });

  it("flags advisors with no billing coverage as onboarding incomplete", async () => {
    const soloUpdatedAt = new Date("2026-05-02T12:00:00Z");
    mockUserFindMany.mockResolvedValue([
      // Solo advisor, no subscription and no firm details — incomplete.
      {
        updatedAt: soloUpdatedAt,
        advisorProfile: { firmName: "" },
        subscription: null,
        enterpriseMembership: null,
      },
      // Active member but firm subscription is past due — incomplete.
      {
        updatedAt: new Date("2026-04-01T12:00:00Z"),
        advisorProfile: { firmName: null },
        subscription: null,
        enterpriseMembership: {
          status: "ACTIVE",
          enterprise: {
            status: "ACTIVE",
            subscription: { status: "PAST_DUE" },
          },
        },
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);

    const alerts = await getControlCenterAlerts();

    const onboarding = alerts.find(
      (a) => a.id === "incomplete-advisor-onboarding"
    );
    expect(onboarding).toBeDefined();
    expect(onboarding?.title).toBe("2 Advisors Onboarding Incomplete");
  });
});
