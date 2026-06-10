import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "test-auth-secret-for-enterprise-team-invites";

import {
  createEnterpriseTeamInviteToken,
  verifyEnterpriseTeamInviteToken,
} from "./team-invite-token";

describe("enterprise team invite token", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a membership id", () => {
    const token = createEnterpriseTeamInviteToken("membership-1");
    expect(verifyEnterpriseTeamInviteToken(token)).toBe("membership-1");
  });

  it("rejects tampered tokens", () => {
    const token = createEnterpriseTeamInviteToken("membership-1");
    expect(verifyEnterpriseTeamInviteToken(`${token}x`)).toBeNull();
  });
});
