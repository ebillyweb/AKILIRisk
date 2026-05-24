import { describe, expect, it } from "vitest";

import { parsePillarDbUuid, pillarDbUuidSchema } from "./pillar-db-uuid";

describe("pillarDbUuidSchema", () => {
  it("accepts Belvedere seed section ids (non–RFC-4122 version nibble)", () => {
    expect(
      pillarDbUuidSchema.safeParse("00000000-0000-0000-0002-000000000005").success
    ).toBe(true);
  });

  it("accepts gen_random_uuid-style ids", () => {
    expect(
      pillarDbUuidSchema.safeParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890").success
    ).toBe(true);
  });

  it("rejects non-uuid strings", () => {
    expect(pillarDbUuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("parsePillarDbUuid", () => {
  it("throws a labeled error on invalid input", () => {
    expect(() => parsePillarDbUuid("bad", "questionId")).toThrow(
      "Invalid questionId."
    );
  });
});
