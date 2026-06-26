/**
 * Handler test for GET /api/advisor/clients/:id/audio/:questionId.
 * Verifies the endpoint will not sign an audioUrl outside the interview's
 * namespace (the confused-deputy / whole-bucket-read fix).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolveUser, getAssignedClientIntake, generateDownloadUrl } = vi.hoisted(() => ({
  resolveUser: vi.fn(),
  getAssignedClientIntake: vi.fn(),
  generateDownloadUrl: vi.fn(),
}));

vi.mock("@/lib/mobile/token", () => ({ resolveUser }));
vi.mock("@/lib/mobile/advisor", () => ({ getAssignedClientIntake }));
vi.mock("@/lib/documents/s3", () => ({ generateDownloadUrl }));

import { GET } from "./route";

const req = new Request("http://localhost") as unknown as import("next/server").NextRequest;
const params = (id: string, questionId: string) => ({ params: Promise.resolve({ id, questionId }) });

function intakeWith(audioUrl: string | null) {
  return {
    client: { id: "client-1" },
    interview: { id: "intv-1", responses: [{ questionId: "q1", audioUrl }] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveUser.mockResolvedValue({ id: "adv-1", role: "ADVISOR" });
  generateDownloadUrl.mockResolvedValue("https://s3.example/signed");
});

describe("GET advisor audio playback", () => {
  it("signs a URL for a key inside the interview namespace", async () => {
    getAssignedClientIntake.mockResolvedValue(intakeWith("intake/intv-1/q1.m4a"));
    const res = await GET(req, params("client-1", "q1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://s3.example/signed" });
    expect(generateDownloadUrl).toHaveBeenCalledWith("intake/intv-1/q1.m4a");
  });

  it("refuses to sign an audioUrl from another interview / namespace", async () => {
    getAssignedClientIntake.mockResolvedValue(intakeWith("intake/OTHER/q1.m4a"));
    const res = await GET(req, params("client-1", "q1"));
    expect(res.status).toBe(404);
    expect(generateDownloadUrl).not.toHaveBeenCalled();
  });

  it("403s a non-advisor", async () => {
    resolveUser.mockResolvedValue({ id: "u1", role: "USER" });
    const res = await GET(req, params("client-1", "q1"));
    expect(res.status).toBe(403);
  });
});
