/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase notification triggers.
 *
 * One test per trigger:
 *   • Asserts sendNotification is called with the recipient (client or
 *     advisor), category, and referenceId we expect.
 *   • Verifies the advisor-only triggers no-op cleanly when the
 *     assigned advisor cannot be resolved (fire-and-forget design).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const sendSpy = vi.fn();
vi.mock("./service", () => ({
  sendNotification: (...args: unknown[]) => sendSpy(...args),
}));

vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: (ct: string) => `decrypted:${ct}`,
}));

const findAssessment = vi.fn();
const findEngagement = vi.fn();
const findAssignment = vi.fn();
const findUser = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: { findUnique: (...args: unknown[]) => findAssessment(...args) },
    portfolioEngagement: { findUnique: (...args: unknown[]) => findEngagement(...args) },
    clientAdvisorAssignment: {
      findFirst: (...args: unknown[]) => findAssignment(...args),
    },
    user: { findUnique: (...args: unknown[]) => findUser(...args) },
  },
}));

import {
  triggerPreviewAvailable,
  triggerProfilePublished,
  triggerEngagementAccepted,
  triggerMeetingScheduled,
  triggerAdvisoryOutreachReminder,
} from "./deliverable-phase-triggers";

beforeEach(() => {
  sendSpy.mockReset();
  findAssessment.mockReset();
  findEngagement.mockReset();
  findAssignment.mockReset();
  findUser.mockReset();
});

describe("triggerPreviewAvailable", () => {
  it("sends a milestone email to the client and to the assigned advisor", async () => {
    findAssessment.mockResolvedValue({
      id: "asmt-1",
      userId: "client-1",
      user: { name: "Alex", emailCiphertext: "cipher-client" },
    });
    findAssignment.mockResolvedValue({
      advisor: {
        id: "adv-prof-1",
        user: { id: "advisor-1", emailCiphertext: "cipher-advisor" },
      },
    });

    await triggerPreviewAvailable("asmt-1");

    expect(sendSpy).toHaveBeenCalledTimes(2);
    const clientCall = sendSpy.mock.calls[0][0];
    const advisorCall = sendSpy.mock.calls[1][0];
    expect(clientCall.recipientUserId).toBe("client-1");
    expect(clientCall.recipientEmail).toBe("decrypted:cipher-client");
    expect(clientCall.category).toBe("milestone");
    expect(clientCall.referenceId).toBe("asmt-1");
    expect(advisorCall.recipientUserId).toBe("advisor-1");
    expect(advisorCall.advisorProfileId).toBe("adv-prof-1");
  });

  it("is a no-op when the assessment cannot be loaded", async () => {
    findAssessment.mockResolvedValue(null);
    await triggerPreviewAvailable("missing");
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("emails only the client when there is no active advisor assignment", async () => {
    findAssessment.mockResolvedValue({
      id: "asmt-1",
      userId: "client-1",
      user: { name: null, emailCiphertext: "cipher-client" },
    });
    findAssignment.mockResolvedValue(null);
    await triggerPreviewAvailable("asmt-1");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].recipientUserId).toBe("client-1");
  });
});

describe("triggerProfilePublished", () => {
  it("emails the client when the assessment is loaded", async () => {
    findAssessment.mockResolvedValue({
      id: "asmt-1",
      userId: "client-1",
      user: { name: "Alex", emailCiphertext: "cipher-client" },
    });
    await triggerProfilePublished("asmt-1");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].recipientUserId).toBe("client-1");
    expect(sendSpy.mock.calls[0][0].category).toBe("milestone");
    expect(sendSpy.mock.calls[0][0].referenceId).toBe("asmt-1");
  });
});

describe("triggerEngagementAccepted", () => {
  it("emails the advisor with an in-app advisorProfileId when resolved", async () => {
    findEngagement.mockResolvedValue({
      id: "eng-1",
      assessmentId: "asmt-1",
      advisorId: "advisor-1",
      client: { name: "Alex" },
    });
    findUser.mockResolvedValue({
      id: "advisor-1",
      emailCiphertext: "cipher-advisor",
      advisorProfile: { id: "adv-prof-1" },
    });
    await triggerEngagementAccepted("eng-1");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0][0];
    expect(call.recipientUserId).toBe("advisor-1");
    expect(call.advisorProfileId).toBe("adv-prof-1");
    expect(call.category).toBe("milestone");
    expect(call.referenceId).toBe("eng-1");
  });

  it("is a no-op when the advisor has no AdvisorProfile row", async () => {
    findEngagement.mockResolvedValue({
      id: "eng-1",
      assessmentId: "asmt-1",
      advisorId: "advisor-1",
      client: { name: "Alex" },
    });
    findUser.mockResolvedValue({
      id: "advisor-1",
      emailCiphertext: "cipher-advisor",
      advisorProfile: null,
    });
    await triggerEngagementAccepted("eng-1");
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe("triggerMeetingScheduled", () => {
  it("emails the client with the meeting date in the body when present", async () => {
    findEngagement.mockResolvedValue({
      id: "eng-1",
      meetingScheduledAt: new Date("2026-06-01T10:00:00Z"),
      meetingAt: new Date("2026-06-10T15:00:00Z"),
      client: { id: "client-1", name: "Alex", emailCiphertext: "cipher-client" },
    });
    await triggerMeetingScheduled("eng-1");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0][0];
    expect(call.recipientUserId).toBe("client-1");
    expect(call.category).toBe("milestone");
    expect(call.referenceId).toBe("eng-1");
    expect(call.message).toContain("2026-06-10");
  });
});

describe("triggerAdvisoryOutreachReminder", () => {
  it("emails the assigned advisor when the assessment is still in PREVIEW", async () => {
    findAssessment.mockResolvedValue({
      id: "asmt-1",
      userId: "client-1",
      previewEnteredAt: new Date("2026-05-25T10:00:00Z"),
      deliverablePhase: "PREVIEW",
      user: { name: "Alex" },
    });
    findAssignment.mockResolvedValue({
      advisor: {
        id: "adv-prof-1",
        user: { id: "advisor-1", emailCiphertext: "cipher-advisor" },
      },
    });
    await triggerAdvisoryOutreachReminder("asmt-1");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].category).toBe("reminder");
    expect(sendSpy.mock.calls[0][0].advisorProfileId).toBe("adv-prof-1");
  });

  it("is a no-op when the assessment has already moved past PREVIEW", async () => {
    findAssessment.mockResolvedValue({
      id: "asmt-1",
      userId: "client-1",
      previewEnteredAt: new Date("2026-05-25T10:00:00Z"),
      deliverablePhase: "PROFILE",
      user: { name: "Alex" },
    });
    await triggerAdvisoryOutreachReminder("asmt-1");
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
