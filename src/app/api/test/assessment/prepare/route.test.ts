import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth/test-auth-enabled", () => ({
  isTestAuthEnabled: vi.fn(),
}));

vi.mock("@/lib/test/complete-assessment-for-e2e", () => ({
  completeAssessmentForE2E: vi.fn(),
}));

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { completeAssessmentForE2E } from "@/lib/test/complete-assessment-for-e2e";

describe("POST /api/test/assessment/prepare", () => {
  beforeEach(() => {
    vi.mocked(isTestAuthEnabled).mockReset();
    vi.mocked(completeAssessmentForE2E).mockReset();
  });

  it("returns 404 when test auth is disabled", async () => {
    vi.mocked(isTestAuthEnabled).mockReturnValue(false);
    const res = await POST(
      new NextRequest("http://localhost/api/test/assessment/prepare", {
        method: "POST",
        body: JSON.stringify({ clientEmail: "client@test.com" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns prepared assessment payload when enabled", async () => {
    vi.mocked(isTestAuthEnabled).mockReturnValue(true);
    vi.mocked(completeAssessmentForE2E).mockResolvedValue({
      userId: "u1",
      clientId: "u1",
      assessmentId: "a1",
      status: "COMPLETED",
      draftReportId: "r1",
      pillarsScored: ["governance"],
    });

    const res = await POST(
      new NextRequest("http://localhost/api/test/assessment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail: "client@test.com", reset: true }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.assessmentId).toBe("a1");
    expect(json.status).toBe("COMPLETED");
    expect(completeAssessmentForE2E).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: "client@test.com", reset: true })
    );
  });
});
