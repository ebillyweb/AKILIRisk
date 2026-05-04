import { describe, it, expect } from "vitest";
import { scrubHouseholdMember } from "./scrub-household-member";

describe("scrubHouseholdMember", () => {
  const FULL_MEMBER = {
    id: "hm-1",
    userId: "user-1",
    fullName: "Jane Smith",
    age: 47,
    occupation: "Architect",
    phone: "+1-555-1234",
    email: "jane@example.com",
    relationship: "SPOUSE",
    governanceRoles: ["DECISION_MAKER", "TRUSTEE"],
    isResident: true,
    shareNameAndContactWithAdvisor: true,
    notes: "irrelevant",
    createdAt: new Date(),
  };

  it("replaces all PII fields with the redacted sentinel", () => {
    const out = scrubHouseholdMember(FULL_MEMBER);
    expect(out).not.toBeNull();
    expect(out!.fullName).toEqual({ redacted: true });
    expect(out!.age).toEqual({ redacted: true });
    expect(out!.occupation).toEqual({ redacted: true });
    expect(out!.phone).toEqual({ redacted: true });
    expect(out!.email).toEqual({ redacted: true });
  });

  it("preserves non-PII fields", () => {
    const out = scrubHouseholdMember(FULL_MEMBER);
    expect(out!.id).toBe("hm-1");
    expect(out!.relationship).toBe("SPOUSE");
    expect(out!.governanceRoles).toEqual(["DECISION_MAKER", "TRUSTEE"]);
    expect(out!.isResident).toBe(true);
    expect(out!.shareNameAndContactWithAdvisor).toBe(true);
  });

  it("ignores share flag — admin-side audit doesn't bypass it", () => {
    const sharedTrue = scrubHouseholdMember({
      ...FULL_MEMBER,
      shareNameAndContactWithAdvisor: true,
    });
    const sharedFalse = scrubHouseholdMember({
      ...FULL_MEMBER,
      shareNameAndContactWithAdvisor: false,
    });
    // PII fields are redacted in BOTH cases — share flag has zero influence
    // on what reaches the audit log.
    expect(sharedTrue!.fullName).toEqual({ redacted: true });
    expect(sharedFalse!.fullName).toEqual({ redacted: true });
  });

  it("returns null for null/undefined", () => {
    expect(scrubHouseholdMember(null)).toBeNull();
    expect(scrubHouseholdMember(undefined)).toBeNull();
  });

  it("handles partial inputs (toggle actions don't have the full row)", () => {
    const partial = scrubHouseholdMember({ id: "hm-2" });
    expect(partial!.id).toBe("hm-2");
    // Even with a partial input, the PII fields are still set to the
    // sentinel so callers can rely on the shape.
    expect(partial!.fullName).toEqual({ redacted: true });
  });

  it("does not include `notes` (out of allowlist) in the output", () => {
    const out = scrubHouseholdMember(FULL_MEMBER);
    // `notes` is potentially free-form PII (medical info, family disputes).
    // Not in the allowlist; should not appear.
    expect((out as Record<string, unknown>).notes).toBeUndefined();
  });
});
