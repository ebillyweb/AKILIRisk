import { describe, it, expect } from "vitest";
import { scrubHouseholdMember } from "./scrub-household-member";

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): tests rewritten for the
 * demographic-only HouseholdMember shape. Pre-round-11 these tests
 * asserted the `{ redacted: true }` sentinel for fullName/age/
 * occupation/phone/email; those columns were dropped from the schema
 * and the helper no longer needs to redact them.
 */
describe("scrubHouseholdMember", () => {
  const FULL_MEMBER = {
    id: "hm-1",
    userId: "user-1",
    displayLabel: "Member A",
    birthYear: 1978,
    sex: "FEMALE",
    relationship: "SPOUSE",
    governanceRoles: ["DECISION_MAKER", "TRUSTEE"],
    isResident: true,
    createdAt: new Date(),
  };

  it("passes through the demographic + relationship fields", () => {
    const out = scrubHouseholdMember(FULL_MEMBER);
    expect(out).not.toBeNull();
    expect(out!.id).toBe("hm-1");
    expect(out!.displayLabel).toBe("Member A");
    expect(out!.birthYear).toBe(1978);
    expect(out!.sex).toBe("FEMALE");
    expect(out!.relationship).toBe("SPOUSE");
    expect(out!.governanceRoles).toEqual(["DECISION_MAKER", "TRUSTEE"]);
    expect(out!.isResident).toBe(true);
  });

  it("returns null for null/undefined", () => {
    expect(scrubHouseholdMember(null)).toBeNull();
    expect(scrubHouseholdMember(undefined)).toBeNull();
  });

  it("handles partial inputs (toggle actions don't have the full row)", () => {
    const partial = scrubHouseholdMember({ id: "hm-2" });
    expect(partial!.id).toBe("hm-2");
    expect(partial!.relationship).toBeUndefined();
  });

  it("preserves null birthYear (unknown DOB) without dropping the field", () => {
    const out = scrubHouseholdMember({
      id: "hm-3",
      relationship: "CHILD",
      birthYear: null,
    });
    expect(out!.birthYear).toBeNull();
  });

  it("preserves null sex (unknown / not stated)", () => {
    const out = scrubHouseholdMember({
      id: "hm-4",
      relationship: "OTHER",
      sex: null,
    });
    expect(out!.sex).toBeNull();
  });

  it("does not include legacy/unknown fields in the output", () => {
    // Defensive: a stale caller might still pass `fullName`/`age`/
    // `phone`/`email`/`notes` from a pre-round-11 cached object.
    // The output should not echo them — only the allowlisted fields
    // come through.
    const stale = scrubHouseholdMember({
      ...FULL_MEMBER,
      fullName: "Jane Smith",
      age: 47,
      occupation: "Architect",
      phone: "+1-555-1234",
      email: "jane@example.com",
      notes: "irrelevant",
      shareNameAndContactWithAdvisor: true,
    } as Record<string, unknown>);
    expect((stale as Record<string, unknown>).fullName).toBeUndefined();
    expect((stale as Record<string, unknown>).age).toBeUndefined();
    expect((stale as Record<string, unknown>).occupation).toBeUndefined();
    expect((stale as Record<string, unknown>).phone).toBeUndefined();
    expect((stale as Record<string, unknown>).email).toBeUndefined();
    expect((stale as Record<string, unknown>).notes).toBeUndefined();
    expect((stale as Record<string, unknown>).shareNameAndContactWithAdvisor).toBeUndefined();
  });
});
