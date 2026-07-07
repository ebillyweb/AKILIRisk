import { describe, it, expect } from "vitest";
import { buildNestedTenantExport, serializeNestedJson } from "./json";
import type { TenantBundle } from "../types";
import { EXPORT_SCHEMA_VERSION } from "../types";

/**
 * Build a synthetic tenant bundle with rich foreign-key relationships so
 * the referential-integrity assertions have something to chew on.
 *
 *   Advisor adv-1
 *     ├── Client u-1 (Alice)
 *     │     ├── intake int-1 → 2 responses, 1 approval
 *     │     ├── assessment as-1 → 3 responses, 2 scores
 *     │     ├── 1 household member
 *     │     ├── 1 doc requirement
 *     │     └── 1 subscription
 *     └── Client u-2 (Bob)
 *           ├── (no intake)
 *           ├── 1 assessment, 0 responses, 1 score
 *           └── 0 household members
 */
function richBundle(): TenantBundle {
  return {
    advisor: { id: "adv-1", userId: "advisor-user", firmName: "Acme Wealth" },
    advisorSubdomain: { id: "sub-1", advisorProfileId: "adv-1", subdomain: "acme" },
    clients: [
      { id: "u-1", email: "alice@example.com" },
      { id: "u-2", email: "bob@example.com" },
    ],
    clientProfiles: [{ id: "cp-1", userId: "u-1", phone: "555-1212" }],
    subscriptions: [{ id: "s-1", userId: "u-1", tier: "PROFESSIONAL" }],
    clientAdvisorAssignments: [
      { id: "a-1", clientId: "u-1", advisorId: "adv-1" },
      { id: "a-2", clientId: "u-2", advisorId: "adv-1" },
    ],
    inviteCodes: [{ id: "ic-1", code: "BELV01", advisorProfileId: "adv-1" }],
    // Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only fixture.
    householdMembers: [
      { id: "hm-1", userId: "u-1", displayLabel: "Member A", birthYear: 1978, sex: "FEMALE", relationship: "SPOUSE", isResident: true },
    ],
    intakeInterviews: [
      { id: "int-1", userId: "u-1", status: "SUBMITTED", updatedAt: "2026-04-01T00:00:00Z" },
    ],
    intakeResponses: [
      { id: "ir-1", interviewId: "int-1", questionId: "q-1" },
      { id: "ir-2", interviewId: "int-1", questionId: "q-2" },
    ],
    intakeApprovals: [
      { id: "ap-1", interviewId: "int-1", advisorId: "adv-1", status: "APPROVED" },
    ],
    assessments: [
      { id: "as-1", userId: "u-1", status: "COMPLETED" },
      { id: "as-2", userId: "u-2", status: "COMPLETED" },
    ],
    assessmentResponses: [
      { id: "ar-1", assessmentId: "as-1", questionId: "q-a", pillar: "governance" },
      { id: "ar-2", assessmentId: "as-1", questionId: "q-b", pillar: "governance" },
      { id: "ar-3", assessmentId: "as-1", questionId: "q-c", pillar: "cyber-digital" },
    ],
    pillarScores: [
      { id: "ps-1", assessmentId: "as-1", pillar: "governance", score: 8.4 },
      { id: "ps-2", assessmentId: "as-1", pillar: "cyber-digital", score: 6.1 },
      { id: "ps-3", assessmentId: "as-2", pillar: "governance", score: 4.2 },
    ],
    documentRequirements: [
      { id: "doc-1", advisorId: "adv-1", clientId: "u-1", name: "Trust Agreement" },
    ],
    advisorNotifications: [],
    governanceReviewLeads: [],
    notificationPreferences: [],
    auditLog: [
      { id: "gen:l-1", action: "user.create", entityType: "User", entityId: "u-1" },
    ],
  };
}

describe("buildNestedTenantExport", () => {
  it("includes the schema version", () => {
    const nested = buildNestedTenantExport(richBundle());
    expect(nested.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
  });

  it("nests advisor + each client", () => {
    const nested = buildNestedTenantExport(richBundle());
    expect(nested.advisor.profile).toMatchObject({ id: "adv-1" });
    expect(nested.advisor.subdomain).toMatchObject({ subdomain: "acme" });
    expect(nested.advisor.inviteCodes).toHaveLength(1);
    expect(nested.clients).toHaveLength(2);
  });

  it("nests intake under the matching client only", () => {
    const nested = buildNestedTenantExport(richBundle());
    const alice = nested.clients.find((c) => (c.user as { id: string }).id === "u-1")!;
    const bob = nested.clients.find((c) => (c.user as { id: string }).id === "u-2")!;
    expect(alice.intake).not.toBeNull();
    expect(alice.intake!.responses).toHaveLength(2);
    expect(alice.intake!.approval).toMatchObject({ id: "ap-1" });
    expect(bob.intake).toBeNull();
  });

  it("nests assessments with their own responses + scores", () => {
    const nested = buildNestedTenantExport(richBundle());
    const alice = nested.clients.find((c) => (c.user as { id: string }).id === "u-1")!;
    expect(alice.assessments).toHaveLength(1);
    expect(alice.assessments[0].responses).toHaveLength(3);
    expect(alice.assessments[0].scores).toHaveLength(2);

    const bob = nested.clients.find((c) => (c.user as { id: string }).id === "u-2")!;
    expect(bob.assessments).toHaveLength(1);
    expect(bob.assessments[0].responses).toHaveLength(0);
    expect(bob.assessments[0].scores).toHaveLength(1);
  });
});

describe("referential integrity", () => {
  /**
   * Walk every nested reference and assert:
   *   - every assessmentId in responses/scores resolves to an assessment in the same client
   *   - every interviewId in intake responses/approval matches the interview id
   *   - every clientId in documentRequirements matches the parent client
   */
  it("nested foreign keys all resolve back into the tree", () => {
    const nested = buildNestedTenantExport(richBundle());
    for (const client of nested.clients) {
      const userId = (client.user as { id: string }).id;
      for (const a of client.assessments) {
        const assessmentId = (a.assessment as { id: string }).id;
        for (const r of a.responses) {
          expect((r as { assessmentId: string }).assessmentId).toBe(assessmentId);
        }
        for (const s of a.scores) {
          expect((s as { assessmentId: string }).assessmentId).toBe(assessmentId);
        }
      }
      if (client.intake) {
        const interviewId = (client.intake.interview as { id: string }).id;
        for (const r of client.intake.responses) {
          expect((r as { interviewId: string }).interviewId).toBe(interviewId);
        }
        if (client.intake.approval) {
          expect((client.intake.approval as { interviewId: string }).interviewId).toBe(interviewId);
        }
      }
      for (const doc of client.documentRequirements) {
        expect((doc as { clientId: string }).clientId).toBe(userId);
      }
    }
  });

  it("does not duplicate a client across nodes", () => {
    const nested = buildNestedTenantExport(richBundle());
    const ids = nested.clients.map((c) => (c.user as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("serializeNestedJson", () => {
  it("produces valid JSON that round-trips", () => {
    const nested = buildNestedTenantExport(richBundle());
    const json = serializeNestedJson(nested);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.clients).toHaveLength(2);
  });

  it("uses 2-space indentation for human readability", () => {
    const nested = buildNestedTenantExport(richBundle());
    const json = serializeNestedJson(nested);
    expect(json.includes("\n  ")).toBe(true);
  });
});
