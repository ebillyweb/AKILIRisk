import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  advisor: null as null | {
    id: string;
    user: { subscription: { tier: "STARTER" | "GROWTH" | "PROFESSIONAL" } | null };
  },
  claimCount: 0,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorProfile: {
      findUnique: vi.fn(async () => dbState.advisor),
    },
    advisorBrandingAuditLog: {
      count: vi.fn(async () => dbState.claimCount),
    },
  },
}));

import { checkRateLimit } from "./validation";

describe("checkRateLimit subdomain_change", () => {
  beforeEach(() => {
    dbState.advisor = {
      id: "adv_1",
      user: { subscription: { tier: "GROWTH" } },
    };
    dbState.claimCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows up to 3 subdomain changes per 24 hours", async () => {
    for (let i = 0; i < 3; i++) {
      dbState.claimCount = i;
      const result = await checkRateLimit("adv_1", "subdomain_change", 24);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3 - i);
    }
  });

  it("blocks the 4th subdomain change within the window", async () => {
    dbState.claimCount = 3;
    const result = await checkRateLimit("adv_1", "subdomain_change", 24);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
