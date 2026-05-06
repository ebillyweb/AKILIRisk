import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * THE security-critical test for the data export (E2 / BRD §5.3).
 *
 * Seeds two synthetic tenants (advisor A with clients aA1/aA2; advisor B
 * with clients bB1/bB2) and asserts that fetching tenant A's bundle
 * returns ZERO rows belonging to tenant B across every Prisma model.
 *
 * Implementation: replace `@/lib/db` with a fake Prisma whose findMany /
 * findUnique inspect the `where` clause and return only matching rows
 * from a small in-memory dataset. The fakes are intentionally permissive
 * (no real schema validation) — what we're testing is whether
 * `fetchTenantBundle` constructs the correct WHERE clauses.
 *
 * Dataset + helpers go in vi.hoisted() so the vi.mock factory (which is
 * itself hoisted to top-of-file) can reference them.
 */

interface Row { [k: string]: unknown }

const { dataset, matches } = vi.hoisted(() => {
  const ds = {
    advisorProfile: [
      { id: "adv-A", userId: "uA", firmName: "Acme A", user: { email: "a@example.com" } },
      { id: "adv-B", userId: "uB", firmName: "Beta B", user: { email: "b@example.com" } },
    ],
    advisorSubdomain: [
      // Schema field is `advisorId` (queries.ts uses `where: { advisorId }`).
      { id: "sub-A", advisorId: "adv-A", subdomain: "acme-a" },
      { id: "sub-B", advisorId: "adv-B", subdomain: "beta-b" },
    ],
    user: [
      { id: "uA", email: "a@example.com", role: "ADVISOR" },
      { id: "uB", email: "b@example.com", role: "ADVISOR" },
      { id: "aA1", email: "a-client-1@example.com", role: "USER" },
      { id: "aA2", email: "a-client-2@example.com", role: "USER" },
      { id: "bB1", email: "b-client-1@example.com", role: "USER" },
      { id: "bB2", email: "b-client-2@example.com", role: "USER" },
    ],
    clientProfile: [
      { id: "cpA1", userId: "aA1", phone: "555-A1" },
      { id: "cpA2", userId: "aA2", phone: "555-A2" },
      { id: "cpB1", userId: "bB1", phone: "555-B1" },
      { id: "cpB2", userId: "bB2", phone: "555-B2" },
    ],
    subscription: [
      { id: "sub-uA", userId: "uA", tier: "PROFESSIONAL" },
      { id: "sub-uB", userId: "uB", tier: "PROFESSIONAL" },
    ],
    clientAdvisorAssignment: [
      { id: "asg-A1", clientId: "aA1", advisorId: "adv-A" },
      { id: "asg-A2", clientId: "aA2", advisorId: "adv-A" },
      { id: "asg-B1", clientId: "bB1", advisorId: "adv-B" },
      { id: "asg-B2", clientId: "bB2", advisorId: "adv-B" },
    ],
    inviteCode: [
      // Schema field is `createdBy` (queries.ts uses `where: { createdBy }`).
      { id: "ic-A", code: "AAA123", createdBy: "adv-A" },
      { id: "ic-B", code: "BBB456", createdBy: "adv-B" },
    ],
    // Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only.
    // fullName / age / phone / email dropped from the schema; the
    // tenant-isolation test only cares that the row's userId is
    // correctly scoped, so the demographic columns are simple stubs.
    householdMember: [
      { id: "hm-A1", userId: "aA1", displayLabel: "Member A", birthYear: 1978, sex: "FEMALE", relationship: "SPOUSE", isResident: true },
      { id: "hm-B1", userId: "bB1", displayLabel: "Member A", birthYear: 1972, sex: "MALE", relationship: "SPOUSE", isResident: true },
    ],
    intakeInterview: [
      { id: "int-A1", userId: "aA1", status: "SUBMITTED" },
      { id: "int-B1", userId: "bB1", status: "SUBMITTED" },
    ],
    intakeApproval: [
      { id: "apv-A1", interviewId: "int-A1", advisorId: "adv-A", status: "APPROVED" },
      { id: "apv-B1", interviewId: "int-B1", advisorId: "adv-B", status: "APPROVED" },
    ],
    assessment: [
      { id: "as-A1", userId: "aA1", status: "COMPLETED" },
      { id: "as-B1", userId: "bB1", status: "COMPLETED" },
    ],
    intakeResponse: [
      { id: "ir-A1", interviewId: "int-A1", questionId: "q1" },
      { id: "ir-B1", interviewId: "int-B1", questionId: "q1" },
    ],
    assessmentResponse: [
      { id: "ar-A1", assessmentId: "as-A1", questionId: "q1", pillar: "governance" },
      { id: "ar-B1", assessmentId: "as-B1", questionId: "q1", pillar: "governance" },
    ],
    pillarScore: [
      { id: "ps-A1", assessmentId: "as-A1", pillar: "governance", score: 8.0 },
      { id: "ps-B1", assessmentId: "as-B1", pillar: "governance", score: 4.0 },
    ],
    documentRequirement: [
      { id: "doc-A1", advisorId: "adv-A", clientId: "aA1", name: "POA" },
      { id: "doc-B1", advisorId: "adv-B", clientId: "bB1", name: "POA" },
    ],
    advisorNotification: [
      { id: "n-A1", advisorId: "adv-A", title: "A note" },
      { id: "n-B1", advisorId: "adv-B", title: "B note" },
    ],
    governanceReviewLead: [
      { id: "lead-A1", assignedAdvisorId: "adv-A", fullName: "Lead A" },
      { id: "lead-B1", assignedAdvisorId: "adv-B", fullName: "Lead B" },
    ],
    notificationPreference: [
      { id: "np-uA", userId: "uA" },
      { id: "np-uB", userId: "uB" },
      { id: "np-aA1", userId: "aA1" },
      { id: "np-bB1", userId: "bB1" },
    ],
    auditLog: [
      { id: "al-A1", actorUserId: "aA1", actorRole: null, actorEmailHash: null, action: "intake.submit", entityType: "IntakeInterview", entityId: "int-A1", beforeData: null, afterData: null, metadata: null, ipAddress: null, userAgent: null, createdAt: new Date("2026-04-01") },
      { id: "al-B1", actorUserId: "bB1", actorRole: null, actorEmailHash: null, action: "intake.submit", entityType: "IntakeInterview", entityId: "int-B1", beforeData: null, afterData: null, metadata: null, ipAddress: null, userAgent: null, createdAt: new Date("2026-04-02") },
    ],
    subscriptionAuditLog: [
      { id: "sal-uA", subscriptionId: "sub-uA", action: "created", timestamp: new Date("2026-01-01"), previousTier: null, newTier: "PROFESSIONAL", metadata: null, source: "stripe" },
      { id: "sal-uB", subscriptionId: "sub-uB", action: "created", timestamp: new Date("2026-01-02"), previousTier: null, newTier: "PROFESSIONAL", metadata: null, source: "stripe" },
    ],
    advisorBrandingAuditLog: [
      { id: "bal-A", advisorId: "adv-A", userId: "uA", action: "branding_update", entityType: "AdvisorProfile", entityId: "adv-A", previousValues: {}, newValues: {}, metadata: null, timestamp: new Date("2026-02-01") },
      { id: "bal-B", advisorId: "adv-B", userId: "uB", action: "branding_update", entityType: "AdvisorProfile", entityId: "adv-B", previousValues: {}, newValues: {}, metadata: null, timestamp: new Date("2026-02-02") },
    ],
  };

  function matchesFn(row: Row, where: unknown): boolean {
    if (!where || typeof where !== "object") return true;
    for (const [key, val] of Object.entries(where as Row)) {
      if (key === "OR") {
        const arr = val as Row[];
        if (!arr.some((sub) => matchesFn(row, sub))) return false;
        continue;
      }
      if (val && typeof val === "object" && "in" in (val as Row)) {
        const list = (val as { in: unknown[] }).in;
        if (!list.includes(row[key])) return false;
        continue;
      }
      if (row[key] !== val) return false;
    }
    return true;
  }

  return { dataset: ds, matches: matchesFn };
});

vi.mock("@/lib/db", () => {
  const makeFake = (rows: Row[]) => ({
    findMany: async ({ where }: { where?: unknown } = {}) =>
      rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }: { where: Row }) =>
      rows.find((r) => Object.entries(where).every(([k, v]) => r[k as keyof typeof r] === v)) ?? null,
  });
  return {
    prisma: {
      advisorProfile: makeFake(dataset.advisorProfile),
      advisorSubdomain: makeFake(dataset.advisorSubdomain),
      user: makeFake(dataset.user),
      clientProfile: makeFake(dataset.clientProfile),
      subscription: makeFake(dataset.subscription),
      clientAdvisorAssignment: makeFake(dataset.clientAdvisorAssignment),
      inviteCode: makeFake(dataset.inviteCode),
      householdMember: makeFake(dataset.householdMember),
      intakeInterview: makeFake(dataset.intakeInterview),
      intakeApproval: makeFake(dataset.intakeApproval),
      assessment: makeFake(dataset.assessment),
      intakeResponse: makeFake(dataset.intakeResponse),
      assessmentResponse: makeFake(dataset.assessmentResponse),
      pillarScore: makeFake(dataset.pillarScore),
      documentRequirement: makeFake(dataset.documentRequirement),
      advisorNotification: makeFake(dataset.advisorNotification),
      governanceReviewLead: makeFake(dataset.governanceReviewLead),
      notificationPreference: makeFake(dataset.notificationPreference),
      auditLog: makeFake(dataset.auditLog),
      subscriptionAuditLog: makeFake(dataset.subscriptionAuditLog),
      advisorBrandingAuditLog: makeFake(dataset.advisorBrandingAuditLog),
    },
  };
});

import { fetchTenantBundle, resolveTenantScope } from "./queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tenant isolation (the gatekeeper test)", () => {
  it("tenant A's bundle contains zero rows belonging to tenant B", async () => {
    const scope = await resolveTenantScope("adv-A");
    expect(scope).not.toBeNull();
    expect(scope!.clientUserIds.sort()).toEqual(["aA1", "aA2"]);

    const bundle = await fetchTenantBundle(scope!);

    const B_IDS = new Set([
      "adv-B", "uB", "bB1", "bB2", "sub-uB", "ic-B", "hm-B1", "int-B1",
      "ir-B1", "as-B1", "ar-B1", "ps-B1", "doc-B1", "n-B1", "lead-B1",
      "np-uB", "apv-B1", "sal-uB", "bal-B", "al-B1",
    ]);

    function assertNoBLeak(label: string, rows: unknown[]) {
      for (const r of rows as Row[]) {
        for (const v of Object.values(r)) {
          if (typeof v === "string" && B_IDS.has(v)) {
            throw new Error(`tenant-A leak in ${label}: value '${v}' appears in row ${JSON.stringify(r)}`);
          }
        }
      }
    }

    assertNoBLeak("advisor", [bundle.advisor!]);
    assertNoBLeak("advisorSubdomain", [bundle.advisorSubdomain!]);
    assertNoBLeak("clients", bundle.clients);
    assertNoBLeak("clientProfiles", bundle.clientProfiles);
    assertNoBLeak("subscriptions", bundle.subscriptions);
    assertNoBLeak("clientAdvisorAssignments", bundle.clientAdvisorAssignments);
    assertNoBLeak("inviteCodes", bundle.inviteCodes);
    assertNoBLeak("householdMembers", bundle.householdMembers);
    assertNoBLeak("intakeInterviews", bundle.intakeInterviews);
    assertNoBLeak("intakeResponses", bundle.intakeResponses);
    assertNoBLeak("intakeApprovals", bundle.intakeApprovals);
    assertNoBLeak("assessments", bundle.assessments);
    assertNoBLeak("assessmentResponses", bundle.assessmentResponses);
    assertNoBLeak("pillarScores", bundle.pillarScores);
    assertNoBLeak("documentRequirements", bundle.documentRequirements);
    assertNoBLeak("advisorNotifications", bundle.advisorNotifications);
    assertNoBLeak("governanceReviewLeads", bundle.governanceReviewLeads);
    assertNoBLeak("notificationPreferences", bundle.notificationPreferences);
    assertNoBLeak("auditLog", bundle.auditLog);
  });

  it("tenant A's bundle includes EVERY row belonging to tenant A", async () => {
    const scope = await resolveTenantScope("adv-A");
    const bundle = await fetchTenantBundle(scope!);

    expect(bundle.advisor).toMatchObject({ id: "adv-A" });
    expect(bundle.advisorSubdomain).toMatchObject({ id: "sub-A" });
    expect(bundle.clients.map((c) => c.id).sort()).toEqual(["aA1", "aA2"]);
    expect(bundle.clientProfiles.map((c) => c.id).sort()).toEqual(["cpA1", "cpA2"]);
    expect(bundle.clientAdvisorAssignments).toHaveLength(2);
    expect(bundle.inviteCodes).toHaveLength(1);
    expect(bundle.householdMembers).toHaveLength(1);
    expect(bundle.intakeInterviews).toHaveLength(1);
    expect(bundle.intakeResponses).toHaveLength(1);
    expect(bundle.intakeApprovals).toHaveLength(1);
    expect(bundle.assessments).toHaveLength(1);
    expect(bundle.assessmentResponses).toHaveLength(1);
    expect(bundle.pillarScores).toHaveLength(1);
    expect(bundle.documentRequirements).toHaveLength(1);
    expect(bundle.advisorNotifications).toHaveLength(1);
    expect(bundle.governanceReviewLeads).toHaveLength(1);

    // Audit log: should include the generic auditLog row referencing
    // int-A1, the subscription audit row for sub-uA, AND the branding
    // audit row for adv-A — three rows total.
    expect(bundle.auditLog).toHaveLength(3);
    const ids = bundle.auditLog.map((r) => r.id as string).sort();
    expect(ids.some((id) => id.startsWith("gen:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("sub:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("brand:"))).toBe(true);
  });

  it("symmetrically, tenant B's bundle contains zero rows belonging to tenant A", async () => {
    const scope = await resolveTenantScope("adv-B");
    const bundle = await fetchTenantBundle(scope!);

    const A_IDS = new Set([
      "adv-A", "uA", "aA1", "aA2", "sub-uA", "ic-A", "hm-A1", "int-A1",
      "ir-A1", "as-A1", "ar-A1", "ps-A1", "doc-A1", "n-A1", "lead-A1",
      "np-uA", "apv-A1", "sal-uA", "bal-A", "al-A1",
    ]);
    function hasNoALeak(rows: unknown[]): boolean {
      for (const r of rows as Row[]) {
        for (const v of Object.values(r)) {
          if (typeof v === "string" && A_IDS.has(v)) return false;
        }
      }
      return true;
    }
    expect(hasNoALeak(bundle.clients)).toBe(true);
    expect(hasNoALeak(bundle.assessments)).toBe(true);
    expect(hasNoALeak(bundle.documentRequirements)).toBe(true);
    expect(hasNoALeak(bundle.auditLog)).toBe(true);
  });

  it("returns null for an unknown advisorProfileId (caller maps to 404)", async () => {
    const scope = await resolveTenantScope("adv-NONEXISTENT");
    expect(scope).toBeNull();
  });
});
